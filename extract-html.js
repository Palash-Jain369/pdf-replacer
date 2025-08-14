#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Extract HTML content from Claude output files
 */
function extractHtmlFromOutputs() {
    const outputDir = process.env.OUTPUT_DIR || './output';
    
    if (!fs.existsSync(outputDir)) {
        console.log('❌ Output directory not found. Run npm test first.');
        return;
    }
    
    const files = fs.readdirSync(outputDir);
    const jsonFiles = files.filter(file => file.startsWith('claude_output_page_') && file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
        console.log('❌ No Claude output files found. Run npm test first.');
        return;
    }
    
    console.log(`📁 Found ${jsonFiles.length} Claude output files`);
    
    const htmlDir = path.join(outputDir, 'extracted-html');
    if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir, { recursive: true });
    }
    
    jsonFiles.forEach(file => {
        const filePath = path.join(outputDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Extract page number from filename
        const pageMatch = file.match(/page_(\d+)\.json/);
        const pageNumber = pageMatch ? pageMatch[1] : 'unknown';
        
        // Try to extract HTML content
        let htmlContent = '';
        
        if (data.claudeResponse && data.claudeResponse.content && data.claudeResponse.content[0]) {
            htmlContent = data.claudeResponse.content[0].text;
        } else if (data.claudeResponse && data.claudeResponse.text) {
            htmlContent = data.claudeResponse.text;
        } else {
            console.log(`⚠️  No HTML content found in ${file}`);
            return;
        }
        
        // Save extracted HTML
        const htmlFilename = `page_${pageNumber}_extracted.html`;
        const htmlPath = path.join(htmlDir, htmlFilename);
        
        fs.writeFileSync(htmlPath, htmlContent);
        console.log(`✅ Extracted HTML from page ${pageNumber}: ${htmlPath}`);
    });
    
    console.log(`\n🎉 HTML extraction complete! Check: ${htmlDir}`);
}

// Run the extraction
extractHtmlFromOutputs(); 