# Chrome Web Store Submission Guide

This document contains all the pre-written content and step-by-step instructions for submitting Site Timer Blocker to the Chrome Web Store.

## 📋 Pre-Submission Checklist

### 1. Developer Account Setup
- [ ] Register Chrome Web Store developer account: https://chrome.google.com/webstore/devconsole/
- [ ] Pay one-time $5 registration fee
- [ ] Verify identity and payment method

### 2. Required Files Ready
- [ ] Extension package (.zip file)
- [ ] Privacy policy hosted online
- [ ] Screenshots and promotional images
- [ ] Store listing content (copy ready below)

---

## 🎯 Store Listing Information

### Basic Information

**Extension Name:**
```
Site Timer Blocker
```

**Summary (132 characters max):**
```
Time-based website blocking with usage analytics. Get limited access to distracting sites without wasting time.
```

**Category:**
```
Productivity
```

**Language:**
```
English (United States)
```

---

## 📝 Detailed Description

**Copy this into the "Detailed description" field:**

```
🎯 Take Control of Your Time Online

Site Timer Blocker helps you maintain focus by setting strict time limits on distracting websites. Perfect for when you need limited access to social media or news sites without completely blocking them.

✨ KEY FEATURES

⏱️ Flexible Time Limits
• Set limits from 1 minute to 1 hour per site
• Automatic blocking when time expires
• Configurable reset intervals (1hr, 8hr, 24hr)

📊 Usage Analytics
• Track actual time spent vs. time limits
• Rolling windows: Last 24h, 7d, 30d, all-time
• Session management with idle detection
• Individual and global reset options

🚀 Smart URL Input
• Paste any URL - automatically extracts trackable domain
• Real-time preview of what will be tracked
• Smart handling of subdomains and www prefixes
• Domain-based table organization

🎨 Modern Interface
• Clean, professional design
• Dark mode support
• Full-tab options page
• Real-time timer updates
• Guided onboarding for new users

🔒 Privacy-First
• All data stored locally in your browser
• No cloud sync or external data collection
• No tracking or analytics services
• Open source principles

💡 HOW IT WORKS

1. Add sites by pasting any URL (e.g., https://www.reddit.com/r/programming)
2. Choose time limits (1min to 1hr) and reset intervals
3. Browse normally - timers start automatically when you visit tracked sites
4. Get blocked when time expires, with automatic reset after your chosen interval
5. Monitor your usage patterns with detailed analytics

🎯 PERFECT FOR

• Students managing study time and social media breaks
• Professionals limiting news/social media during work hours
• Anyone wanting controlled access to distracting sites
• People interested in understanding their browsing habits

🔧 TECHNICAL DETAILS

• Chrome Manifest V3 for modern security
• Works on all websites (requires broad permissions for site blocking)
• Local storage only - no data leaves your device
• Real-time session tracking with 2-minute idle timeout
• Comprehensive error handling and graceful fallbacks

⚡ GET STARTED

Install the extension and you'll be guided through setup on first use. Start with short time limits (1-5 minutes) and adjust based on your usage patterns!

🛡️ PERMISSIONS EXPLAINED

This extension requires broad permissions (<all_urls>) because:
• Users can block any website - we can't predict which domains
• Content scripts display blocking messages on any site when time expires
• Tab redirection is needed to enforce time limits
• All permissions are used solely for core site blocking functionality

Your privacy is protected - we never read page content or collect personal data.
```

---

## 🖼️ Visual Assets Required

### Screenshots (1280x800 or 640x400)

**Screenshot 1: Main Options Page**
- Filename: `screenshot_main_options.png`
- Caption: "Clean, intuitive interface for managing site timers and viewing usage analytics"

**Screenshot 2: Smart URL Input**
- Filename: `screenshot_url_input.png` 
- Caption: "Paste any URL and see exactly what domain will be tracked with real-time preview"

**Screenshot 3: Usage Analytics**
- Filename: `screenshot_analytics.png`
- Caption: "Comprehensive time tracking with rolling windows and session management"

**Screenshot 4: Dark Mode**
- Filename: `screenshot_dark_mode.png`
- Caption: "Full dark mode support that adapts to your system preferences"

**Screenshot 5: Onboarding**
- Filename: `screenshot_onboarding.png`
- Caption: "Guided setup helps new users get started quickly and effectively"

### Promotional Images

**Promotional Tile (440x280):**
- Filename: `promo_tile_440x280.png`
- Design: Extension icon + "Site Timer Blocker" text + "Take Control of Your Time"

**Promotional Marquee (1400x560) - Optional:**
- Filename: `promo_marquee_1400x560.png` 
- Design: Feature highlights with screenshots

### Icon
- Use: `icons/icon128.png` (already created)

---

## 🔒 Privacy Policy

**Privacy Policy URL:** 
```
[You need to host this at a public URL, suggestions below]
```

**Privacy Policy Content:**

```html
<!DOCTYPE html>
<html>
<head>
    <title>Site Timer Blocker - Privacy Policy</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1, h2 { color: #2e7d32; }
        .last-updated { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <h1>Privacy Policy for Site Timer Blocker</h1>
    <p class="last-updated">Last updated: [Current Date]</p>

    <h2>Overview</h2>
    <p>Site Timer Blocker is designed with privacy as a core principle. This extension operates entirely within your browser and does not collect, transmit, or store any personal data on external servers.</p>

    <h2>Data Collection</h2>
    <p><strong>We collect NO personal data.</strong> The extension does not:</p>
    <ul>
        <li>Track your browsing history</li>
        <li>Read page content from websites you visit</li>
        <li>Collect personal information</li>
        <li>Use analytics or tracking services</li>
        <li>Transmit data to external servers</li>
        <li>Share data with third parties</li>
    </ul>

    <h2>Local Data Storage</h2>
    <p>The extension stores the following data locally in your browser using Chrome's storage API:</p>
    <ul>
        <li><strong>Domain Timer Settings:</strong> Website domains you choose to track and their time limits</li>
        <li><strong>Usage Analytics:</strong> Time spent on tracked domains (stored as daily totals)</li>
        <li><strong>User Preferences:</strong> Your chosen settings like reset intervals</li>
    </ul>
    <p>All data remains on your device and is never transmitted anywhere.</p>

    <h2>Permissions Usage</h2>
    <p>The extension requires broad permissions (&lt;all_urls&gt;) for its core functionality:</p>
    <ul>
        <li><strong>Storage:</strong> Save your settings and usage data locally</li>
        <li><strong>Active Tab:</strong> Monitor which sites you're visiting to start timers</li>
        <li><strong>Tabs:</strong> Redirect you when time limits are reached</li>
        <li><strong>All URLs:</strong> Enable blocking on any website you choose to track</li>
    </ul>
    <p>These permissions are used exclusively for site blocking functionality, not data collection.</p>

    <h2>Data Security</h2>
    <p>Since all data is stored locally in your browser:</p>
    <ul>
        <li>Data is protected by Chrome's security model</li>
        <li>No data transmission means no interception risk</li>
        <li>You can delete all data by removing the extension</li>
        <li>Data does not sync across devices unless you enable Chrome sync</li>
    </ul>

    <h2>Third-Party Services</h2>
    <p>Site Timer Blocker does not integrate with any third-party services, analytics platforms, or external APIs.</p>

    <h2>Children's Privacy</h2>
    <p>This extension does not collect personal information from anyone, including children under 13.</p>

    <h2>Changes to Privacy Policy</h2>
    <p>Any changes to this privacy policy will be posted here and in the extension's Chrome Web Store listing.</p>

    <h2>Contact</h2>
    <p>Questions about this privacy policy can be submitted through the Chrome Web Store support tab for Site Timer Blocker.</p>

    <p><em>This extension is designed to help you manage your time while respecting your privacy completely.</em></p>
</body>
</html>
```

**Where to Host Privacy Policy:**
1. **GitHub Pages** (free): Create a repository, upload the HTML file, enable Pages
2. **Netlify** (free): Drag and drop HTML file to deploy
3. **Google Sites** (free): Copy/paste content into a new site
4. **Your own website** if you have one

---

## ⚖️ Permissions Justification

**Copy this for the "Permissions" section:**

```
REQUIRED PERMISSIONS EXPLANATION:

Storage: Saves your site timer settings and usage analytics locally in your browser. No data is transmitted externally.

Active Tab: Monitors which website you're currently visiting to start and stop timers appropriately. Only domain names are accessed, not page content.

Tabs: Enables redirecting you away from sites when time limits are reached - the core blocking functionality.

Host Permissions (<all_urls>): Required because users can add ANY website to their timer list. We cannot predict which domains users want to block, so broad permissions are necessary for:
- Injecting content scripts to display blocking messages
- Redirecting tabs when time expires  
- Monitoring any domain for timer enforcement

PRIVACY COMMITMENT: Despite broad permissions, this extension NEVER reads page content, collects personal data, or transmits information to external servers. All functionality is local-only for site blocking purposes.
```

---

## 🎯 Test Instructions for Review Team

**Copy this for the "Test instructions" field:**

```
TESTING SITE TIMER BLOCKER:

1. BASIC FUNCTIONALITY:
   - Open extension options (right-click icon → Options)
   - Add a test site by pasting any URL (e.g., https://example.com)
   - Set a very short time limit (1 minute) for quick testing
   - Visit the test site - timer should start automatically
   - Stay on the site until time expires - should redirect to new tab
   - Return to options to see time tracking data populated

2. KEY FEATURES TO TEST:
   - Smart URL input: Paste "reddit.com/r/test" → should extract "reddit.com"
   - Analytics: View "Last 24h" column for tracked time
   - Reset functions: Use "Reset Timers" and "Reset All Tracking" buttons
   - Dark mode: Change system to dark mode, verify interface adapts
   - Onboarding: Install fresh to see welcome flow

3. IMPORTANT NOTES:
   - Extension needs <all_urls> permissions for core functionality
   - All data stays local - no network requests made
   - Default sites are included for immediate testing
   - Use very short time limits (1-2 minutes) for quick verification

The extension is designed for productivity - helping users limit time on distracting sites while maintaining some access.
```

---

## 📦 Packaging Instructions

### Create Extension Package

1. **Clean the directory:**
```bash
# Remove development files
rm -rf .git
rm -rf node_modules
rm CLAUDE.md GEMINI.md TASKS.md SPEC.md
rm PERMISSIONS_JUSTIFICATION.md
rm CHROME_WEB_STORE_SUBMISSION.md
```

2. **Files to include in ZIP:**
- `manifest.json`
- `background.js`
- `content.js` 
- `options.html`
- `options.js`
- `storage-utils.js`
- `icons/` folder (with all PNG files)
- `README.md`

3. **Create ZIP file:**
```bash
zip -r site-timer-blocker-v1.0.zip manifest.json background.js content.js options.html options.js storage-utils.js icons/ README.md
```

---

## 🚀 Submission Steps

### Step 1: Prepare Materials
- [ ] Create screenshots (5 images at 1280x800)
- [ ] Create promotional tile (440x280)
- [ ] Host privacy policy online and get URL
- [ ] Create extension ZIP package
- [ ] Review all copy above for accuracy

### Step 2: Chrome Web Store Developer Console
1. Go to: https://chrome.google.com/webstore/devconsole/
2. Click "Add new item"
3. Upload your ZIP file
4. Fill out store listing using content above
5. Upload images and screenshots
6. Add privacy policy URL
7. Paste permissions justification
8. Add test instructions
9. Set visibility to "Public"
10. Submit for review

### Step 3: Post-Submission
- [ ] Monitor email for review updates
- [ ] Respond to any reviewer questions promptly
- [ ] Prepare to make changes if requested
- [ ] Celebrate when approved! 🎉

---

## 💡 Pro Tips

1. **Review Time:** Can take 1-7 days, sometimes longer during busy periods
2. **Common Issues:** Permission justifications and privacy policy clarity
3. **Screenshots:** Show actual functionality, not just pretty designs
4. **Description:** Focus on user benefits, not technical features
5. **Keywords:** Include "productivity", "time management", "focus", "website blocker"

**Ready to launch!** 🚀