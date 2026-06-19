# Site Timer Blocker

A Chrome extension for time-based website blocking with comprehensive usage analytics.

## Project Structure

```
site-blocker-extension/
├── src/                    # Extension source code
│   ├── manifest.json       # Extension manifest
│   ├── background.js       # Service worker
│   ├── content.js          # Content script
│   ├── options.html        # Options page UI
│   ├── options.js          # Options page logic
│   ├── popup.html          # Toolbar popup UI
│   ├── popup.js            # Toolbar popup logic
│   ├── storage-utils.js    # Storage utilities
│   ├── timer-utils.js      # Timer calculation helpers
│   └── icons/              # Extension icons (PNG)
├── scripts/                # Build and distribution scripts
│   └── package.mjs         # Distribution packaging (npm run package)
├── docs/                   # Project documentation
│   ├── README.md           # Extension user documentation
│   ├── SPEC.md             # Technical specifications
│   ├── CHROME_WEB_STORE_SUBMISSION.md  # Store submission guide
│   ├── RELEASE_CHECKLIST.md # Pre-launch checklist
│   ├── TASKS.md            # Development task tracking
│   ├── PERMISSIONS_JUSTIFICATION.md # Permission explanations
│   ├── CLAUDE.md           # Development workflow instructions
│   └── GEMINI.md           # Additional development notes
└── assets/                 # Design assets and tools
    ├── icon.svg            # Master icon design
    ├── create_icons.html   # Icon generator tool
    └── README.md           # Asset documentation
```

## Quick Start

### Development
```
# Load extension in Chrome
1. Open chrome://extensions/
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the src/ folder
```

### Distribution
```bash
# Create the Chrome Web Store distribution package (dist/)
npm run package
```
Builds `dist/extension/`, copies store assets, and produces
`dist/site-timer-blocker-v<version>.zip` ready for upload. Requires the
system `zip` command (preinstalled on macOS and Linux).

### Documentation
- **Extension features**: docs/README.md
- **Chrome Web Store submission**: docs/CHROME_WEB_STORE_SUBMISSION.md
- **Technical specs**: docs/SPEC.md
- **Release checklist**: docs/RELEASE_CHECKLIST.md

## Features

🎯 **Time-based site blocking** with customizable limits  
📊 **Usage analytics** with rolling windows  
🚀 **Smart URL input** with domain extraction  
🧰 **Toolbar popup** for quick status, one-click blocking, and password-gated pause  
🎨 **Modern UI** with dark mode support  
🔒 **Privacy-first** with local-only data storage

## License

This project is for personal use and educational purposes.