# Assets Directory

This directory contains design assets and tools for the Site Timer Blocker extension.

## Files

### `icon.svg`
- **Purpose**: Master SVG source file for the extension icon
- **Design**: Timer/clock with red X overlay indicating site blocking
- **Size**: 128x128 viewBox, scalable vector graphics
- **Colors**: Green (#4CAF50) background, white clock face, red (#F44336) blocking X

### `create_icons.html`
- **Purpose**: HTML tool to generate PNG icons from the SVG design
- **Usage**: 
  1. Open in any web browser
  2. Icons are automatically rendered in all required sizes
  3. Download PNG files using the provided links
  4. Save as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in `/icons/` folder
- **Sizes Generated**: 16x16, 32x32, 48x48, 128x128 pixels

## Icon Design Notes

The icon represents:
- **Timer/Clock**: Core functionality of time-based site blocking
- **Green Color**: Positive, productive time management
- **Red X Overlay**: Clear indication of blocking/restriction
- **Professional Appearance**: Clean, modern design suitable for Chrome Web Store

## Usage in Extension

The generated PNG files should be placed in `/icons/` and referenced in `manifest.json`:

```json
"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png", 
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

## Updating Icons

To modify the icon design:
1. Edit `icon.svg` with any SVG editor
2. Open `create_icons.html` in browser to regenerate PNGs
3. Replace files in `/icons/` directory
4. Test extension with new icons