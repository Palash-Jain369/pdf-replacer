#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 PDF Replacer Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env file from template...');
    
    if (fs.existsSync(envExamplePath)) {
        const envContent = fs.readFileSync(envExamplePath, 'utf8');
        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env file created successfully!');
    } else {
        console.log('❌ env.example file not found!');
        process.exit(1);
    }
} else {
    console.log('✅ .env file already exists');
}

// Check if output directories exist
const outputDir = path.join(__dirname, 'output');
const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('✅ Created output directory');
}

if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log('✅ Created screenshots directory');
}

console.log('\n📋 Next steps:');
console.log('1. Edit the .env file and add your Claude API key');
console.log('2. Get your API key from: https://console.anthropic.com/');
console.log('3. Run: npm test');
console.log('\n�� Setup complete!'); 