# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF Replacer is a Node.js tool that converts PDF pages to screenshots and uses Claude Vision API to generate HTML recreations. The system processes PDFs by taking high-quality screenshots of each page, then sending them to Claude Vision with prompts to generate 16:9 ratio HTML containers that replicate the visual content.

## Essential Commands

### Setup and Development
```bash
# Initial setup - creates .env file and directories
npm run setup

# Main processing command - converts PDF to HTML via screenshots
npm start

# Alternative direct execution
node converter.js
```

### System Dependencies
- **macOS**: `brew install graphicsmagick` (required for pdf2pic)

## Architecture

### Core Files
- **converter.js**: Main entry point that orchestrates the full PDF processing workflow
- **helper.js**: Contains all core functionality including screenshot generation, LLM API calls, and HTML parsing
- **setup.js**: Initial setup script for environment configuration

### Processing Pipeline
1. **PDF Screenshot Generation**: Uses pdf2pic to convert each PDF page to PNG images
2. **Claude Vision API Integration**: Sends screenshots with structured prompts to generate HTML
3. **HTML Parsing**: Extracts and unescapes HTML content from JSON-wrapped LLM responses
4. **Output Management**: Saves both raw LLM responses and parsed HTML files

### Key Functions (helper.js)
- `takePdfScreenshots()`: Converts PDF pages to images using pdf2pic
- `sendScreenshotsToLLM()`: Handles Claude Vision API communication with proper error handling and rate limiting
- `parseHtmlFromLLMResponse()`: Robust parser that handles multiple response formats (JSON, code blocks, direct HTML)
- `processPdfFile()`: Main orchestration function that chains the entire workflow

### Configuration
Environment variables are managed via `.env` file:
- `CLAUDE_API_KEY`: Required for Claude Vision API access
- `OUTPUT_DIR`: Directory for processed outputs (default: ./output)
- `SCREENSHOT_DIR`: Directory for PDF screenshots (default: ./screenshots)

### Output Structure
- `claude_output_page_X.json`: Complete API responses with metadata
- `html_output_page_X.html`: Extracted HTML content ready for use
- `processing_summary.json`: Session summary with file paths and metadata
- `screenshots/page.X.png`: PDF page screenshots

## Important Implementation Details

### LLM Prompt Strategy
The system uses a specific prompt that requests Claude to generate 16:9 ratio HTML containers using Tailwind CSS and Google Fonts, with strict JSON output formatting.

### Error Handling
- Robust API timeout handling (60s for Claude requests)
- Rate limiting with 2-second delays between requests
- Multiple HTML parsing fallbacks for different response formats

### Dependencies
- pdf2pic: PDF to image conversion
- axios: HTTP client for API requests
- dotenv: Environment variable management
- form-data: Multipart form handling