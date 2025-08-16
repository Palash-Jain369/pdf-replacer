const fs = require('fs');
const path = require('path');
const pdf2pic = require('pdf2pic');
const axios = require('axios');
const FormData = require('form-data');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

function slugifyFilename(filename) {
    return filename
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function takePdfScreenshots(pdfPath, outputDir = './output', options = {}) {
    try {
        const pdfFilename = path.basename(pdfPath);
        const pdfSlug = slugifyFilename(pdfFilename);
        const screenshotDir = path.join(outputDir, pdfSlug, 'screenshots');
        
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        const defaultOptions = {
            density: 150,
            saveFilename: "page",
            savePath: screenshotDir,
            format: "png",
            width: 1200,
            height: 900
        };

        const config = { ...defaultOptions, ...options };
        const convert = pdf2pic.fromPath(pdfPath, config);
        
        console.log(`📄 Converting PDF to screenshots...`);
        const results = await convert.bulk(-1);
        const screenshotPaths = results.map((_, index) => {
            const filename = `${config.saveFilename}.${index + 1}.${config.format}`;
            return path.join(screenshotDir, filename);
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
            
            const prompt = `Create a pixel-perfect HTML recreation of this image as a 16:9 ratio container. The output will be converted to PDF, so focus on exact visual replication.

CRITICAL REQUIREMENTS:
- Match EXACT colors, gradients, shadows, borders, and visual effects from the image
- Replicate precise positioning, spacing, margins, and padding
- Use identical font sizes, weights, and line heights
- Reproduce exact background colors, patterns, textures, or gradients
- Match border styles, corner radii, and shadow effects precisely
- Maintain exact proportions and aspect ratios of all elements

COLOR & VISUAL ACCURACY:
- Extract and use the exact hex/RGB colors from the image
- Reproduce gradients with precise color stops and directions
- Match shadow blur, spread, and opacity values exactly
- Replicate any background patterns, textures, or images
- Ensure proper contrast and color relationships

TYPOGRAPHY PRECISION:
- Use Google Fonts to match font families as closely as possible
- Set exact font sizes, weights (100-900), and letter spacing
- Match line heights and text alignment precisely
- Reproduce any text shadows, outlines, or effects

LAYOUT ACCURACY:
- Use CSS Grid/Flexbox for precise positioning
- Match exact spacing between elements
- Reproduce border styles, widths, and corner radius
- Maintain proper z-index layering and element stacking
- Ensure responsive behavior matches original proportions

TECHNICAL REQUIREMENTS:
- Use Tailwind CSS via cdn.tailwindcss.com
- Include appropriate Google Fonts
- Replace template variables ({{name}}, {{date}}, etc.) with realistic dummy data
- Use semantic HTML structure
- Optimize for PDF rendering (no animations or hover effects)

Output format: {"output":"your complete HTML response"}

Focus on creating an exact visual replica that will render identically when converted to PDF.`;
            const payload = {
                model: "claude-sonnet-4-20250514",
                max_tokens: 8192,
                temperature: 0.3,
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
        
        const pdfFilename = path.basename(pdfPath);
        const pdfSlug = slugifyFilename(pdfFilename);
        
        return {
            pdfPath,
            pdfSlug,
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

async function convertHtmlToPdf(htmlPath, outputPath, browser = null) {
    try {
        const shouldCloseBrowser = !browser;
        if (!browser) {
            browser = await puppeteer.launch();
        }
        
        const page = await browser.newPage();
        
        // Set viewport to match 16:9 aspect ratio for consistent rendering
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });
        
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Add CSS to ensure content fits in a single page
        const modifiedHtml = htmlContent.replace(
            '</head>',
            `<style>
                @page {
                    size: A4 landscape;
                    margin: 0;
                }
                html, body {
                    width: 100vw;
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                * {
                    box-sizing: border-box;
                }
                .aspect-video {
                    aspect-ratio: 16/9;
                    width: 100vw;
                    height: 100vh;
                }
            </style>
            </head>`
        );
        
        await page.setContent(modifiedHtml, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        
        await page.pdf({
            path: outputPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            preferCSSPageSize: true
        });
        
        await page.close();
        
        if (shouldCloseBrowser) {
            await browser.close();
        }
        
        console.log(`✅ Generated PDF: ${path.basename(outputPath)}`);
        
    } catch (error) {
        console.error('Error converting HTML to PDF:', error);
        throw error;
    }
}

async function combineMultiplePdfs(pdfPaths, outputPath) {
    try {
        const mergedPdf = await PDFDocument.create();
        
        for (const pdfPath of pdfPaths) {
            const pdfBytes = fs.readFileSync(pdfPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach((page) => mergedPdf.addPage(page));
        }
        
        const mergedPdfBytes = await mergedPdf.save();
        fs.writeFileSync(outputPath, mergedPdfBytes);
        console.log(`✅ Combined PDF saved: ${path.basename(outputPath)}`);
        
    } catch (error) {
        console.error('Error combining PDFs:', error);
        throw error;
    }
}

async function generateFinalPdf(outputDir, pdfSlug) {
    try {
        const htmlDir = path.join(outputDir, pdfSlug, 'html');
        const pdfDir = path.join(outputDir, pdfSlug, 'pdf');
        
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }
        
        const htmlFiles = fs.readdirSync(htmlDir)
            .filter(file => file.endsWith('.html'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/page_(\d+)/)?.[1] || '0');
                const numB = parseInt(b.match(/page_(\d+)/)?.[1] || '0');
                return numA - numB;
            });
        
        console.log(`📄 Converting ${htmlFiles.length} HTML files to PDF in parallel...`);
        
        // Use a shared browser instance for all conversions
        const browser = await puppeteer.launch();
        
        try {
            // Convert HTML files to PDFs in parallel using shared browser
            const pdfConversions = htmlFiles.map(async (htmlFile) => {
                const htmlPath = path.join(htmlDir, htmlFile);
                const pdfFileName = htmlFile.replace('.html', '.pdf');
                const pdfPath = path.join(pdfDir, pdfFileName);
                
                await convertHtmlToPdf(htmlPath, pdfPath, browser);
                return pdfPath;
            });
            
            const pdfPaths = await Promise.all(pdfConversions);
            
            const finalPdfPath = path.join(outputDir, pdfSlug, `${pdfSlug}-combined.pdf`);
            await combineMultiplePdfs(pdfPaths, finalPdfPath);
            
            console.log(`🎉 Final combined PDF generated: ${finalPdfPath}`);
            return finalPdfPath;
            
        } finally {
            await browser.close();
        }
        
    } catch (error) {
        console.error('Error generating final PDF:', error);
        throw error;
    }
}

module.exports = {
    takePdfScreenshots,
    sendScreenshotsToLLM,
    processPdfFile,
    readCsvData,
    parseHtmlFromLLMResponse,
    convertHtmlToPdf,
    combineMultiplePdfs,
    generateFinalPdf
}; 