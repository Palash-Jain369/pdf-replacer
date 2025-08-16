const fs = require('fs');
const path = require('path');
const pdf2pic = require('pdf2pic');
const axios = require('axios');
const FormData = require('form-data');

async function takePdfScreenshots(pdfPath, outputDir = './screenshots', options = {}) {
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const defaultOptions = {
            density: 100,
            saveFilename: "page",
            savePath: outputDir,
            format: "png",
            width: 800,
            height: 600
        };

        const config = { ...defaultOptions, ...options };
        const convert = pdf2pic.fromPath(pdfPath, config);
        
        console.log(`📄 Converting PDF to screenshots...`);
        const results = await convert.bulk(-1);
        const screenshotPaths = results.map((_, index) => {
            const filename = `${config.saveFilename}.${index + 1}.${config.format}`;
            return path.join(outputDir, filename);
        });
        
        console.log(`✅ Generated ${screenshotPaths.length} screenshots`);
        return screenshotPaths;
        
    } catch (error) {
        console.error('Error taking PDF screenshots:', error);
        throw error;
    }
}

async function sendScreenshotsToLLM(screenshotPaths, apiKey = null) {
    try {
        console.log(`🤖 Processing ${screenshotPaths.length} screenshots with Claude Vision...`);
        
        const processScreenshot = async (screenshotPath, index) => {
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64Image = imageBuffer.toString('base64');
            
            const prompt = `Create an HTML container section of 16:9 ratio that looks exactly like the image attached here. It should be a single HTML file using cdn.tailwindcss.com and google font cdn. Replace all moustache variables with dummy data. Output should be strictly json: "output":"your response"

`;
            const payload = {
                model: "claude-sonnet-4-20250514",
                max_tokens: 4096,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt
                            },
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: "image/png",
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ]
            };
            
            try {
                const response = await axios.post(
                    'https://api.anthropic.com/v1/messages',
                    payload,
                    {
                        headers: {
                            'x-api-key': `${apiKey}`,
                            'Content-Type': 'application/json',
                            'anthropic-version': '2023-06-01'
                        },
                        timeout: 60000
                    }
                );
                console.log(`✅ Completed ${index + 1}/${screenshotPaths.length}`);
                return {
                    screenshotPath,
                    analysis: response.data,
                    timestamp: new Date().toISOString(),
                    index
                };
            } catch (error) {
                console.log(`❌ Failed ${index + 1}/${screenshotPaths.length}: ${error.message}`);
                return {
                    screenshotPath,
                    analysis: null,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    index
                };
            }
        };
        
        const promises = screenshotPaths.map((screenshotPath, index) => 
            processScreenshot(screenshotPath, index)
        );
        
        const results = await Promise.all(promises);
        results.sort((a, b) => a.index - b.index);
        results.forEach(result => delete result.index);
        
        const successCount = results.filter(result => !result.error).length;
        const errorCount = results.filter(result => result.error).length;
        console.log(`🎉 LLM processing complete: ${successCount} successful, ${errorCount} failed`);
        
        return results;
        
    } catch (error) {
        console.error('Error sending screenshots to Claude Vision:', error);
        throw error;
    }
}

function parseHtmlFromLLMResponse(llmResponse) {
    try {
        if (!llmResponse || !llmResponse.content || !Array.isArray(llmResponse.content)) {
            return null;
        }

        const textContent = llmResponse.content[0]?.text;
        if (!textContent) {
            return null;
        }
        try {
            const jsonResponse = JSON.parse(textContent);
            if (jsonResponse.output) {
                return jsonResponse.output
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\t/g, '\t')
                    .replace(/\\r/g, '\r')
                    .replace(/\\\\/g, '\\');
            }
        } catch (jsonError) {
            const jsonBlockMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch) {
                try {
                    const jsonResponse = JSON.parse(jsonBlockMatch[1].trim());
                    if (jsonResponse.output) {
                        return jsonResponse.output
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\t/g, '\t')
                            .replace(/\\r/g, '\r')
                            .replace(/\\\\/g, '\\');
                    }
                } catch (jsonBlockError) {}
            }
        }

        if (textContent.trim().startsWith('<!DOCTYPE html>') || textContent.trim().startsWith('<html')) {
            return textContent;
        }

        const htmlMatch = textContent.match(/```html\s*([\s\S]*?)\s*```/);
        if (htmlMatch) {
            return htmlMatch[1].trim();
        }

        const htmlPattern = /<html[\s\S]*?<\/html>/i;
        const match = textContent.match(htmlPattern);
        if (match) {
            return match[0];
        }

        return null;

    } catch (error) {
        console.error('Error parsing HTML from LLM response:', error);
        return null;
    }
}

async function readCsvData(csvFilePath) {
    try {
        const csvData = fs.readFileSync(csvFilePath, 'utf8');
        return csvData;
    } catch (error) {
        console.error('Error reading CSV file:', error);
        throw error;
    }
}


async function processPdfFile(pdfPath, outputDir = './screenshots', apiKey = null, useAlternativeLLM = false) {
    try {
        console.log(`🚀 Processing PDF: ${path.basename(pdfPath)}`);
        const screenshotPaths = await takePdfScreenshots(pdfPath, outputDir);
        let llmResults;
        if (useAlternativeLLM) {
            llmResults = await sendScreenshotsToAlternativeLLM(screenshotPaths);
        } else {
            llmResults = await sendScreenshotsToLLM(screenshotPaths, apiKey);
        }
        
        return {
            pdfPath,
            screenshotPaths,
            llmResults,
            totalPages: screenshotPaths.length,
            processedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Error processing PDF file:', error);
        throw error;
    }
}

module.exports = {
    takePdfScreenshots,
    sendScreenshotsToLLM,
    processPdfFile,
    readCsvData,
    parseHtmlFromLLMResponse
}; 