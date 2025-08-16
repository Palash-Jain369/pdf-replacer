require('dotenv').config();
const { processPdfFile, readCsvData, parseHtmlFromLLMResponse, generateFinalPdf } = require('./helper.js');
const fs = require('fs');
const path = require('path');

async function processPdf() {
    try {
        console.log('🚀 Starting PDF processing...');
        
        const pdfPath = './samples/sample deck_2.pdf';
        const csvPath = './data2.csv';
        const claudeOutputDir = process.env.OUTPUT_DIR || './output';
        
        if (!fs.existsSync(claudeOutputDir)) {
            fs.mkdirSync(claudeOutputDir, { recursive: true });
        }
        
        console.log('📁 Reading CSV data...');
        const csvData = await readCsvData(csvPath);
        const apiKey = process.env.CLAUDE_API_KEY;
        
        if (!apiKey || apiKey === 'your-claude-api-key-here') {
            throw new Error('Claude API key not found. Please set CLAUDE_API_KEY in your .env file');
        }
        
        const results = await processPdfFile(pdfPath, claudeOutputDir, apiKey);
        
        const pdfOutputDir = path.join(claudeOutputDir, results.pdfSlug);
        const jsonDir = path.join(pdfOutputDir, 'json');
        const htmlDir = path.join(pdfOutputDir, 'html');
        
        if (!fs.existsSync(jsonDir)) {
            fs.mkdirSync(jsonDir, { recursive: true });
        }
        if (!fs.existsSync(htmlDir)) {
            fs.mkdirSync(htmlDir, { recursive: true });
        }
        
        console.log('💾 Saving outputs...');
        const savedFiles = [];
        
        for (let i = 0; i < results.llmResults.length; i++) {
            const result = results.llmResults[i];
            const pageNumber = i + 1;
            
            const outputFilename = `claude_output_page_${pageNumber}.json`;
            const outputPath = path.join(jsonDir, outputFilename);
            
            const outputData = {
                page: pageNumber,
                screenshotPath: result.screenshotPath,
                timestamp: result.timestamp,
                claudeResponse: result.analysis,
                csvData: csvData
            };
            
            fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
            savedFiles.push(outputPath);
            
            if (result.analysis && result.analysis.content && result.analysis.content[0] && result.analysis.content[0].text) {
                const htmlContent = parseHtmlFromLLMResponse(result.analysis);
                if (htmlContent) {
                    const htmlFilename = `html_output_page_${pageNumber}.html`;
                    const htmlPath = path.join(htmlDir, htmlFilename);
                    
                    fs.writeFileSync(htmlPath, htmlContent);
                    savedFiles.push(htmlPath);
                }
            }
        }
        
        const summaryPath = path.join(pdfOutputDir, 'processing_summary.json');
        const summary = {
            processedAt: new Date().toISOString(),
            pdfPath: pdfPath,
            csvPath: csvPath,
            totalPages: results.totalPages,
            outputFiles: savedFiles,
            screenshotPaths: results.screenshotPaths
        };
        
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log(`🎉 Processing complete! Generated ${savedFiles.length} files in ${pdfOutputDir}`);
        
        console.log('📄 Generating final combined PDF...');
        const finalPdfPath = await generateFinalPdf(claudeOutputDir, results.pdfSlug);
        console.log(`✅ Final PDF saved: ${finalPdfPath}`);
        
    } catch (error) {
        console.error('Processing failed:', error);
        process.exit(1);
    }
}

processPdf(); 