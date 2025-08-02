# Extension Source Code

This directory contains all the source files for the Site Timer Blocker Chrome extension.

## Files

- **manifest.json** - Extension manifest (Manifest V3)
- **background.js** - Service worker for timer logic and session management
- **content.js** - Content script for displaying blocked pages
- **options.html** - Options page user interface
- **options.js** - Options page functionality and event handling
- **storage-utils.js** - Shared storage utility functions
- **icons/** - Extension icons in required sizes (16x16, 32x32, 48x48, 128x128)

## Development

To load this extension in Chrome for testing:

1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this src/ directory

## Architecture

- **Manifest V3** compliant
- **Local storage only** - no external data transmission
- **Async/await** patterns throughout
- **Content Security Policy** enforced
- **Modern JavaScript** with proper error handling