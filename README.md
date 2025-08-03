# OpenAPI Diff Tool

A web-based application for comparing OpenAPI/Swagger specifications and visualizing differences in a chronological timeline format.

## Features

- **Drag-and-drop file upload** supporting JSON, YAML, and YML OpenAPI specifications
- **Comprehensive comparison engine** that analyzes:
  - Info changes (version, title)
  - Path additions/removals/modifications
  - HTTP method changes
  - Parameter changes
  - Request/response body changes
  - Schema and component changes
- **Visual timeline interface** with filtering capabilities
- **Breaking vs non-breaking change detection**
- **Real-time statistics dashboard**
- **Multiple export formats** (Markdown, JSON, HTML)

## Usage

1. Open `index.html` in your web browser
2. Upload two OpenAPI/Swagger specification files using the drag-and-drop interface
3. Click "Compare API Specifications" to analyze differences
4. View results in the interactive timeline
5. Use filters to focus on specific change types
6. Export results in your preferred format for documentation or sharing

## File Structure

```
openapidiff/
├── index.html              # Main application entry point
├── styles.css              # Application styling and responsive design
├── script.js               # Core JavaScript logic and OpenAPIDiff class
├── openapi_diff_tool.html  # Legacy single-file version
└── README.md               # This file
```

## Architecture

### Core Components

- **OpenAPIDiff Class**: Main JavaScript class handling file processing, comparison logic, and UI updates
- **File Upload System**: Drag-and-drop interface with support for multiple file formats
- **Comparison Engine**: Deep analysis of API specification differences
- **Timeline UI**: Visual representation of changes with interactive filtering
- **Export System**: Generate reports in multiple formats for different use cases

### Change Detection

The tool categorizes changes into:
- **Added**: New paths, methods, parameters, or schemas
- **Removed**: Deleted API elements
- **Modified**: Changes to existing API components
- **Breaking**: Changes that may break existing API consumers
- **Non-breaking**: Backward-compatible changes

## Export Formats

### Markdown Export
Clean, readable format perfect for documentation and README files with:
- Summary statistics
- Breaking changes highlighted
- Detailed change information
- Categorized sections

### JSON Export
Structured data format for programmatic consumption and integration with other tools.

### HTML Export
Standalone web page with embedded styling for easy sharing and presentation.

## Technical Details

- **No build process required** - Static web application
- **Browser-based** - Runs entirely client-side
- **CDN dependencies** - Uses js-yaml library via CDN
- **Responsive design** - Works on desktop and mobile devices

## Brand and Design

The application uses the stefandango.dev brand identity with:
- Dark theme with blue accents (#0078d4, #1e40af)
- Multi-layered gradient backgrounds
- Inter font family
- Card-based layout with backdrop blur effects
- Professional developer-focused aesthetic

## Getting Started

Simply open `index.html` in any modern web browser. No installation or setup required.

## Use Cases

- **API versioning** - Compare different versions of your API
- **Documentation** - Generate change reports for API consumers
- **Code review** - Analyze API changes during development
- **Migration planning** - Identify breaking changes before deployment
- **Compliance** - Track API evolution for regulatory requirements

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- File API for drag-and-drop uploads
- Fetch API for file processing

---

Built with ❤️ by [stefandango.dev](https://stefandango.dev)