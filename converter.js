require('dotenv').config();
const { takePdfScreenshots, sendScreenshotsToLLM, processPdfFile, readCsvData, parseHtmlFromLLMResponse } = require('./helper.js');
const fs = require('fs');
const path = require('path');

async function testPdfProcessing() {
    try {
        const pdfPath = './samples/sample deck_2.pdf';
        const csvPath = './data2.csv';
        const outputDir = process.env.SCREENSHOT_DIR || './screenshots';
        const claudeOutputDir = process.env.OUTPUT_DIR || './output';
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(claudeOutputDir)) {
            fs.mkdirSync(claudeOutputDir, { recursive: true });
        }
        
        console.log('Starting PDF processing test...');
        
        // Test 0: Test the HTML parser function
        console.log('\n=== Test 0: Testing HTML parser function ===');
        const mockLLMResponse = {
            content: [{
                text: '{"output": "<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n    <meta charset=\\"UTF-8\\">\\n    <title>Test</title>\\n</head>\\n<body>\\n    <h1>Hello World</h1>\\n    <p>This is a test with \\"quotes\\" and newlines</p>\\n</body>\\n</html>"}'
            }]
        };
        const parsedHtml = parseHtmlFromLLMResponse(mockLLMResponse);
        console.log('Parser test result:', parsedHtml ? '✅ Success' : '❌ Failed');
        if (parsedHtml) {
            console.log('Parsed HTML preview:', parsedHtml.substring(0, 150) + '...');
            console.log('Contains newlines:', parsedHtml.includes('\n') ? '✅ Yes' : '❌ No');
            console.log('Contains quotes:', parsedHtml.includes('"') ? '✅ Yes' : '❌ No');
            console.log('Contains escaped chars:', parsedHtml.includes('\\n') || parsedHtml.includes('\\"') ? '❌ Yes (should not)' : '✅ No');
        }
        
        // Test JSON code block parsing
        console.log('\n=== Test 0.1: Testing JSON code block parser ===');
        const mockLLMResponseCodeBlock = {
            content: [{
                text: '```json\n{\n  "output": "<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n    <title>Code Block Test</title>\\n</head>\\n<body>\\n    <h1>Code Block Works!</h1>\\n</body>\\n</html>"\n}\n```'
            }]
        };
        const parsedHtmlCodeBlock = parseHtmlFromLLMResponse(mockLLMResponseCodeBlock);
        console.log('Code block parser test result:', parsedHtmlCodeBlock ? '✅ Success' : '❌ Failed');
        if (parsedHtmlCodeBlock) {
            console.log('Code block HTML preview:', parsedHtmlCodeBlock.substring(0, 100) + '...');
            console.log('Code block contains newlines:', parsedHtmlCodeBlock.includes('\n') ? '✅ Yes' : '❌ No');
            console.log('Code block contains escaped chars:', parsedHtmlCodeBlock.includes('\\n') || parsedHtmlCodeBlock.includes('\\"') ? '❌ Yes (should not)' : '✅ No');
        }
        
        // Test 1: Just take screenshots
        console.log('\n=== Test 1: Taking PDF screenshots ===');
        const screenshotPaths = await takePdfScreenshots(pdfPath, outputDir);
        console.log('Screenshots saved to:', screenshotPaths);
        
        // Test 2: Read CSV data
        console.log('\n=== Test 2: Reading CSV data ===');
        const csvData = await readCsvData(csvPath);
        console.log('CSV data loaded:', csvData.substring(0, 200) + '...');
        
        // Test 3: Process entire PDF with Claude Vision and CSV data
        console.log('\n=== Test 3: Full PDF processing with Claude Vision ===');
        
        // Get API key from environment
        const apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey || apiKey === 'your-claude-api-key-here') {
            console.log('⚠️  Warning: Claude API key not found. Please set CLAUDE_API_KEY in your .env file');
            console.log('   Skipping Claude Vision processing...');
            return;
        }
        
        console.log('✅ Claude API key found, proceeding with processing...');
        
        const results = await processPdfFile(pdfPath, csvData, outputDir, apiKey);
        console.log('Processing completed!');
        console.log('Total pages processed:', results.totalPages);
        
        // Save Claude outputs to files
        console.log('\n=== Test 4: Saving Claude outputs ===');
        const savedFiles = [];
        
        for (let i = 0; i < results.llmResults.length; i++) {
            const result = results.llmResults[i];
            const pageNumber = i + 1;
            
            // Create filename based on page number
            const outputFilename = `claude_output_page_${pageNumber}.json`;
            const outputPath = path.join(claudeOutputDir, outputFilename);
            
            // Save the full response
            const outputData = {
                page: pageNumber,
                screenshotPath: result.screenshotPath,
                timestamp: result.timestamp,
                claudeResponse: result.analysis,
                csvData: csvData
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
            savedFiles.push(outputPath);
            
            console.log(`✅ Saved Claude output for page ${pageNumber}: ${outputPath}`);
            
            // Also save just the HTML content if available
            if (result.analysis && result.analysis.content && result.analysis.content[0] && result.analysis.content[0].text) {
                const htmlContent = parseHtmlFromLLMResponse(result.analysis);
                if (htmlContent) {
                    const htmlFilename = `html_output_page_${pageNumber}.html`;
                    const htmlPath = path.join(claudeOutputDir, htmlFilename);
                    
                    fs.writeFileSync(htmlPath, htmlContent);
                    console.log(`✅ Saved HTML output for page ${pageNumber}: ${htmlPath}`);
                    savedFiles.push(htmlPath);
                } else {
                    console.log(`⚠️  Could not parse HTML content for page ${pageNumber}`);
                }
            }
        }
        
        console.log(`\n🎉 All outputs saved to: ${claudeOutputDir}`);
        console.log(`📁 Total files created: ${savedFiles.length}`);
        
        // Create a summary file
        const summaryPath = path.join(claudeOutputDir, 'processing_summary.json');
        const summary = {
            processedAt: new Date().toISOString(),
            pdfPath: pdfPath,
            csvPath: csvPath,
            totalPages: results.totalPages,
            outputFiles: savedFiles,
            screenshotPaths: results.screenshotPaths
        };
        
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        console.log(`📋 Processing summary saved: ${summaryPath}`);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testPdfProcessing(); 