# PDF Replacer - Screenshot and LLM Analysis Tool

This tool provides functionality to take screenshots of PDF pages and send them to free image LLM services for analysis.

## Features

- **PDF Screenshot**: Convert each page of a PDF to high-quality images
- **Claude Vision Integration**: Send screenshots to Claude Vision API for HTML generation
- **CSV Data Replacement**: Replace moustache variables with CSV data
- **HTML Canvas Generation**: Generate 16:9 ratio HTML canvases using Tailwind CSS
- **Flexible Configuration**: Customize screenshot quality and output format
- **Batch Processing**: Process entire PDFs automatically

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install system dependencies (for pdf2pic):
   - **macOS**: `brew install imagemagick`
   - **Ubuntu/Debian**: `sudo apt-get install imagemagick`
   - **Windows**: Download and install ImageMagick from the official website

3. Set up environment variables:
```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file and add your Claude API key
# Get your API key from: https://console.anthropic.com/
```

## Usage

### Basic Usage

```javascript
const { takePdfScreenshots, sendScreenshotsToLLM, processPdfFile, readCsvData } = require('./helper.js');

// Take screenshots of a PDF
const screenshotPaths = await takePdfScreenshots('./your-file.pdf', './output');

// Read CSV data
const csvData = await readCsvData('./data.csv');

// Send screenshots to Claude Vision with CSV data
const results = await sendScreenshotsToLLM(screenshotPaths, csvData, 'your-claude-api-key');

// Or process everything at once
const fullResults = await processPdfFile('./your-file.pdf', csvData, './output', 'your-claude-api-key');
```

### Advanced Configuration

```javascript
// Custom screenshot options
const options = {
    density: 150,        // Higher resolution
    format: "jpg",       // JPEG format
    width: 1200,         // Custom width
    height: 800          // Custom height
};

const screenshots = await takePdfScreenshots('./file.pdf', './output', options);
```

### Using with Claude Vision API

For HTML generation with CSV data replacement, use Claude Vision API:

```javascript
const results = await sendScreenshotsToLLM(
    screenshotPaths, 
    csvData,
    'your-claude-api-key'
);
```

## API Reference

### `takePdfScreenshots(pdfPath, outputDir, options)`

Takes screenshots of each page in a PDF file.

**Parameters:**
- `pdfPath` (string): Path to the PDF file
- `outputDir` (string): Directory to save screenshots (default: './screenshots')
- `options` (object): Screenshot configuration options

**Returns:** Promise<string[]> - Array of screenshot file paths

### `sendScreenshotsToLLM(screenshotPaths, csvData, apiKey)`

Sends screenshots to Claude Vision API for HTML generation with CSV data replacement.

**Parameters:**
- `screenshotPaths` (string[]): Array of screenshot file paths
- `csvData` (string): CSV data to replace moustache variables
- `apiKey` (string): Claude API key

**Returns:** Promise<Object[]> - Array of analysis results

### `processPdfFile(pdfPath, csvData, outputDir, apiKey, useAlternativeLLM)`

Complete PDF processing pipeline with Claude Vision integration.

**Parameters:**
- `pdfPath` (string): Path to the PDF file
- `csvData` (string): CSV data to replace moustache variables
- `outputDir` (string): Directory to save screenshots
- `apiKey` (string): Claude API key
- `useAlternativeLLM` (boolean): Use alternative LLM service

**Returns:** Promise<Object> - Complete processing results

### `readCsvData(csvFilePath)`

Reads CSV data from a file.

**Parameters:**
- `csvFilePath` (string): Path to the CSV file

**Returns:** Promise<string> - CSV data as string

## Claude Vision Integration

The tool is configured to work with:

1. **Claude Vision API** - For HTML generation with CSV data replacement
2. **Alternative services** - Can be configured for other image analysis APIs

## Running Tests

```bash
# First time setup
npm run setup

# Run the main test
npm test

# Extract HTML from outputs (after running test)
npm run extract-html
```

This will process the sample PDF file included in the project and save outputs to the `output/` directory.

### Output Files

The test generates several types of output files:

- **`claude_output_page_X.json`** - Full Claude API response for each page
- **`html_output_page_X.html`** - Generated HTML content for each page
- **`processing_summary.json`** - Summary of the entire processing session

### Environment Variables

Create a `.env` file with the following variables:

```env
CLAUDE_API_KEY=your-actual-claude-api-key
OUTPUT_DIR=./output
SCREENSHOT_DIR=./screenshots
```

## Notes

- The tool uses `pdf2pic` which requires ImageMagick to be installed on your system
- Claude Vision API requires a valid API key from Anthropic
- The tool generates HTML canvases with 16:9 ratio using Tailwind CSS CDN
- CSV data is used to replace moustache variables in the generated HTML
- Screenshots are saved as PNG files by default for best quality
- Processing large PDFs may take some time depending on the number of pages

## Troubleshooting

1. **ImageMagick not found**: Install ImageMagick for your operating system
2. **API rate limits**: The tool includes delays between requests to avoid rate limiting
3. **Memory issues**: For very large PDFs, consider processing pages in batches 