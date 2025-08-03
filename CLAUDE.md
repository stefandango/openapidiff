# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web application called "OpenAPI Diff Tool" that allows users to compare two OpenAPI/Swagger specifications and visualize the differences in a chronological timeline format.

## File Structure

The application has been split into separate files for better maintainability:

- **index.html**: Main HTML structure and layout
- **styles.css**: All CSS styling and responsive design
- **script.js**: JavaScript application logic and OpenAPIDiff class
- **openapi_diff_tool.html**: Original single-file version (legacy)

## Architecture

**Modular Structure**: The application is now organized into separate HTML, CSS, and JavaScript files for better development workflow.

**Key Components**:
- **OpenAPIDiff Class**: Main JavaScript class handling file processing, comparison logic, and UI updates
- **File Upload System**: Drag-and-drop interface supporting JSON, YAML, and YML OpenAPI specifications
- **Comparison Engine**: Analyzes differences between API specs including:
  - Info changes (version, title)
  - Path additions/removals/modifications
  - HTTP method changes
  - Parameter changes
  - Request/response body changes
  - Schema and component changes
- **Timeline UI**: Visual representation of changes with filtering capabilities
- **Statistics Dashboard**: Real-time counts of different change types

**Change Detection Logic**:
- Compares paths, methods, parameters, responses, and schemas
- Categorizes changes as: added, removed, modified
- Identifies breaking vs non-breaking changes
- Provides detailed change information with old/new value comparisons

## Development Notes

**No Build Process**: This is a static web application with no build, test, or lint configuration. All dependencies are loaded via CDN (js-yaml library).

**Browser-Based**: The application runs entirely in the browser with no server-side components.

**File Organization**: The codebase is now split into separate HTML, CSS, and JavaScript files for better maintainability and development workflow.

## Usage

To use this tool:
1. Open `index.html` in a web browser
2. Upload two OpenAPI/Swagger specification files (JSON, YAML, or YML format)
3. Click "Compare API Specifications" to analyze differences
4. View results in the timeline with filtering options for different change types

The tool provides detailed analysis of API changes including breaking changes, new endpoints, removed functionality, and schema modifications.

## Export Features

The tool now includes comprehensive export functionality to generate user-friendly reports for API consumers:

### Export Formats

1. **Markdown Export** - Clean, readable format perfect for documentation and README files
2. **JSON Export** - Structured data format for programmatic consumption and integration
3. **HTML Export** - Standalone web page with embedded styling for easy sharing

### Report Structure

All exported reports include:
- **Summary statistics** (total changes, breaking changes, additions, removals, modifications)
- **Breaking changes highlighted first** for immediate attention
- **Detailed change information** with context and specifics
- **Categorized sections** for easy navigation
- **Timestamps and metadata** for tracking

### Usage for API Communication

These exports are specifically designed for communicating API changes to users:
- **Breaking changes** are prominently featured with clear warnings
- **Impact details** explain what each change means for consumers
- **Path-specific information** helps developers locate affected endpoints
- **Human-readable format** makes technical changes understandable

## Branding and Theme

The application uses the stefandango.dev brand and visual identity:

### Design System
- **Color Palette**: Dark theme matching stefandango.dev with blue accents (#0078d4, #1e40af)
- **Background**: Multi-layered gradient from dark blues to blacks
- **Typography**: Inter font family for modern, clean appearance
- **Layout**: Card-based design with backdrop blur effects and subtle shadows
- **Spacing**: Consistent spacing scale following the main site's patterns

### Brand Integration
- **Header branding** with stefandango.dev link
- **Professional appearance** suitable for developer tools
- **Responsive design** that works across all devices
- **Clean, minimal aesthetic** following modern web design principles