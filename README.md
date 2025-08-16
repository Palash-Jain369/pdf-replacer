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
   - **macOS**: `brew install graphicsmagick`


### Output Files

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
