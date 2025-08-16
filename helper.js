const fs = require('fs');
const path = require('path');
const pdf2pic = require('pdf2pic');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Takes screenshots of each page of a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputDir - Directory to save screenshots (optional, defaults to './screenshots')
 * @param {Object} options - Screenshot options
 * @returns {Promise<string[]>} Array of screenshot file paths
 */
async function takePdfScreenshots(pdfPath, outputDir = './screenshots', options = {}) {
    try {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Default options for pdf2pic
        const defaultOptions = {
            density: 100,           // Output resolution
            saveFilename: "page",   // Output filename
            savePath: outputDir,    // Output path
            format: "png",          // Output format
            width: 800,             // Output width
            height: 600             // Output height
        };

        const config = { ...defaultOptions, ...options };
        
        // Initialize pdf2pic
        const convert = pdf2pic.fromPath(pdfPath, config);
        
        // Get PDF info to determine number of pages
        const pdfInfo = await convert.bulk(-1, { responseType: "array" });
        const totalPages = pdfInfo.length;
        
        console.log(`Converting ${totalPages} pages from ${pdfPath}`);
        
        // Convert all pages to images
        const results = await convert.bulk(-1);
        
        // Extract file paths from results
        const screenshotPaths = results.map((result, index) => {
            const filename = `${config.saveFilename}.${index + 1}.${config.format}`;
            return path.join(outputDir, filename);
        });
        
        console.log(`Successfully created ${screenshotPaths.length} screenshots`);
        return screenshotPaths;
        
    } catch (error) {
        console.error('Error taking PDF screenshots:', error);
        throw error;
    }
}

/**
 * Sends screenshots to Claude Vision API with CSV data replacement
 * @param {string[]} screenshotPaths - Array of screenshot file paths
 * @param {string} csvData - CSV data to replace moustache variables
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object[]>} Array of analysis results
 */
async function sendScreenshotsToLLM(screenshotPaths, csvData, apiKey = null) {
    try {
        const results = [];
        
        for (const screenshotPath of screenshotPaths) {
            console.log(`Processing screenshot: ${screenshotPath}`);
            
            // Read the image file
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64Image = imageBuffer.toString('base64');
            
            // Prepare the prompt with CSV data
            const prompt = `Create an HTML container section of 16:9 ratio that looks exactly like the image attached here. It should be a single HTML file using cdn.tailwindcss.com and google font cdn. Replace all moustache variables with dummy data. Output should be strictly json: "output":"your response"

`;
            console.log(prompt);
            // Prepare the request payload for Claude Vision
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
            
            // Make API request to Claude
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                payload,
                {
                    headers: {
                        'x-api-key': `${apiKey}`,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: 60000 // 60 second timeout for Claude
                }
            );
            
            results.push({
                screenshotPath,
                analysis: response.data,
                timestamp: new Date().toISOString()
            });
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return results;
        
    } catch (error) {
        console.error('Error sending screenshots to Claude Vision:', error);
        throw error;
    }
}

/**
 * Parses HTML content from LLM response
 * @param {Object} llmResponse - The response from the LLM API
 * @returns {string|null} Extracted HTML content or null if not found
 */
function parseHtmlFromLLMResponse(llmResponse) {
    try {
        // Check if we have the basic structure
        if (!llmResponse || !llmResponse.content || !Array.isArray(llmResponse.content)) {
            console.log('No content array found in LLM response');
            return null;
        }

        const textContent = llmResponse.content[0]?.text;
        if (!textContent) {
            console.log('No text content found in LLM response');
            return null;
        }

        // Try to parse as JSON first (most common case)
        try {
            const jsonResponse = JSON.parse(textContent);
            if (jsonResponse.output) {
                console.log('✅ Successfully extracted HTML from JSON output key');
                // Unescape the HTML content (remove escaped characters)
                const unescapedHtml = jsonResponse.output
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\t/g, '\t')
                    .replace(/\\r/g, '\r')
                    .replace(/\\\\/g, '\\');
                return unescapedHtml;
            }
        } catch (jsonError) {
            console.log('Response is not valid JSON, checking for JSON in code blocks');
            
            // Check for JSON in code blocks (```json ... ```)
            const jsonBlockMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch) {
                try {
                    const jsonResponse = JSON.parse(jsonBlockMatch[1].trim());
                    if (jsonResponse.output) {
                        console.log('✅ Successfully extracted HTML from JSON code block');
                        // Unescape the HTML content (remove escaped characters)
                        const unescapedHtml = jsonResponse.output
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\t/g, '\t')
                            .replace(/\\r/g, '\r')
                            .replace(/\\\\/g, '\\');
                        return unescapedHtml;
                    }
                } catch (jsonBlockError) {
                    console.log('JSON in code block is not valid, checking for direct HTML content');
                }
            }
        }

        // If not JSON, check if it's direct HTML content
        if (textContent.trim().startsWith('<!DOCTYPE html>') || textContent.trim().startsWith('<html')) {
            console.log('✅ Found direct HTML content');
            return textContent;
        }

        // Check for HTML content within the text (fallback)
        const htmlMatch = textContent.match(/```html\s*([\s\S]*?)\s*```/);
        if (htmlMatch) {
            console.log('✅ Found HTML content within code blocks');
            return htmlMatch[1].trim();
        }

        // Check for any HTML-like content
        const htmlPattern = /<html[\s\S]*?<\/html>/i;
        const match = textContent.match(htmlPattern);
        if (match) {
            console.log('✅ Found HTML content using pattern matching');
            return match[0];
        }

        console.log('❌ No HTML content found in LLM response');
        console.log('Response content preview:', textContent.substring(0, 200) + '...');
        return null;

    } catch (error) {
        console.error('Error parsing HTML from LLM response:', error);
        return null;
    }
}

/**
 * Reads CSV data from a file
 * @param {string} csvFilePath - Path to the CSV file
 * @returns {Promise<string>} CSV data as string
 */
async function readCsvData(csvFilePath) {
    try {
        const csvData = fs.readFileSync(csvFilePath, 'utf8');
        return csvData;
    } catch (error) {
        console.error('Error reading CSV file:', error);
        throw error;
    }
}


/**
 * Main function to process a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} csvData - CSV data to replace moustache variables
 * @param {string} outputDir - Directory to save screenshots
 * @param {string} apiKey - Claude API key
 * @param {boolean} useAlternativeLLM - Whether to use alternative LLM service
 * @returns {Promise<Object>} Processing results
 */
async function processPdfFile(pdfPath, csvData, outputDir = './screenshots', apiKey = null, useAlternativeLLM = false) {
    try {
        console.log(`Processing PDF: ${pdfPath}`);
        
        // Take screenshots
        const screenshotPaths = await takePdfScreenshots(pdfPath, outputDir);
        
        // Send to LLM
        let llmResults;
        if (useAlternativeLLM) {
            llmResults = await sendScreenshotsToAlternativeLLM(screenshotPaths);
        } else {
            llmResults = await sendScreenshotsToLLM(screenshotPaths, csvData, apiKey);
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