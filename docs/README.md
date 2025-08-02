# Site Blocker Extension

A Chrome extension for time-based website blocking with comprehensive usage analytics. Get limited access to distracting sites - just enough to view random links you come across, but not so much that you waste a lot of time.

## ✨ Features

### 🎯 Smart Domain Management
- **Intelligent URL Input**: Paste any URL format and automatically extract the trackable domain
- **Real-time Preview**: See exactly what domain will be tracked before adding
- **Domain-based Sorting**: Related domains grouped together (reddit.com, www.reddit.com, old.reddit.com)

### ⏱️ Flexible Time Controls
- **Time Limits**: 1min, 5min, 10min, 30min, 1hr options
- **Reset Intervals**: 1hr, 8hr, 24hr with 24hr default
- **Real-time Updates**: Timer displays update every second

### 📊 Usage Analytics
- **Time Tracking**: Track actual time spent vs. time limits
- **Rolling Windows**: Last 24h, 7d, 30d, and all-time analytics
- **Session Management**: Automatic idle detection (2-minute timeout)
- **Reset Controls**: Individual domain or global tracking reset

### 🎨 Modern Interface
- **Full-tab Options**: Professional, responsive design
- **Box-style Controls**: Intuitive radio button interface
- **Visual Feedback**: Real-time validation and status updates
- **Consistent Styling**: Cohesive design system throughout

## 🚀 Quick Start

1. **Install the extension** (load unpacked in Chrome)
2. **Open options page** from extension menu
3. **Add domains**: Paste any URL (e.g., `https://www.reddit.com/r/programming`)
4. **Set time limits**: Choose from 1min to 1hr
5. **Configure reset interval**: How often timers reset (1hr, 8hr, 24hr)

## 📖 How It Works

### Adding Domains
```
Input: https://www.reddit.com/r/programming/posts/123
Preview: Will track: reddit.com
Result: Tracks reddit.com with your chosen time limit
```

### Time Management
- Navigate to tracked domain → Timer starts counting down
- Navigate away → Timer pauses
- Time expires → Domain becomes blocked until reset
- Reset interval passes → Timer automatically resets

### Analytics Dashboard
View comprehensive usage data in the options table:
- **Time Left**: Remaining time for current period
- **Last 24h/7d/30d**: Actual time spent in rolling windows
- **All Time**: Total time since tracking started
- **Last Reset**: When timer was last reset

## 🔧 Technical Details

- **Manifest V3**: Modern Chrome extension architecture
- **Local Storage**: All data stored locally, no cloud dependencies
- **Service Worker**: Efficient background processing
- **Real-time Updates**: Sub-second accuracy for timers and analytics
- **Error Handling**: Comprehensive validation and graceful fallbacks

## 📁 Project Structure

```
├── src/                   # Extension source code
│   ├── manifest.json      # Extension configuration
│   ├── background.js      # Service worker for timer logic
│   ├── options.html       # Options page UI
│   ├── options.js         # Options page logic
│   ├── content.js         # Content script for blocked pages
│   ├── storage-utils.js   # Shared storage utilities
│   └── icons/             # Extension icons
├── docs/                  # Documentation (this folder)
├── scripts/               # Build and distribution tools
└── assets/                # Design files and icon tools
```

## 🛠️ Development

### Setup
```bash
# Load extension in Chrome
1. Open Chrome → Extensions → Developer mode
2. Click "Load unpacked"
3. Select the src/ directory
```

### Storage Data Models
- **domainTimers**: Timer configurations and current state
- **timeTracking**: Analytics data with daily aggregation

See `SPEC.md` for detailed technical specifications.

## 📋 Roadmap

- [ ] Subdomain support with intelligent grouping
- [ ] Enhanced analytics with weekly/monthly reports
- [ ] Goal setting and progress tracking
- [ ] Export functionality for usage data
- [ ] Temporary bypass options
- [ ] Custom warning messages

## 🤝 Contributing

This project follows atomic, incremental development principles. See `TASKS.md` for the current development workflow and `CLAUDE.md` for contribution guidelines.

## 📄 License

This project is for personal use and educational purposes.