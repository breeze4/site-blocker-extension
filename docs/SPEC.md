# Site Blocker Extension

A Chrome extension for time-based website blocking with comprehensive usage analytics.

## Overview

When you want very limited access to sites, just enough to view random links you come across, but not so much you can waste a lot of time. The extension provides both blocking functionality and detailed analytics to help users understand their browsing patterns.

## Current Features

### Core Timer Functionality
* Add/remove domains with customizable time limits (1min, 5min, 10min, 30min, 1hr)
* Automatic timer countdown when visiting tracked domains
* Page blocking when time limit is exceeded
* Configurable reset intervals (1hr, 8hr, 24hr) with 24hr default
* Real-time timer display updating every second in options page

### Time Tracking Analytics  
* Real-time tracking of actual time spent on domains
* Rolling window analytics: Last 24h, 7d, 30d, All Time
* Session management with 2-minute idle detection
* Individual and global reset tracking functionality
* Daily data aggregation with automatic 30-day cleanup

### User Interface
* Full-tab options page with responsive table layout
* Box-style radio button interface for all settings
* Live-updating displays without disrupting user interactions
* Inline editing with save functionality
* Professional styling with consistent design system

### Streamlined URL Input
* Intelligent URL parsing with real-time domain extraction
* Support for full URLs, partial URLs, and domain names
* Visual feedback showing what domain will be tracked
* Smart handling of subdomains and www prefixes
* Domain-based table sorting for logical organization

### Toolbar Popup
* Click the toolbar icon to open a compact popup for the current tab
* Shows the current site's remaining time and a progress bar relative to its limit
* One-click "Block this site" to start tracking the current domain with sensible defaults
* Password-gated "Pause blocking" to temporarily disable enforcement across all sites
* Quick link to open the full Options page
* Graceful states for untracked sites and non-trackable pages (e.g. chrome:// pages)

## Technical Specifications

This is a Chrome extension designed to limit the time spent on specific websites.

### Manifest (`manifest.json`)

*   **Manifest Version**: 3
*   **Permissions**:
    *   `storage`: To store the domain timers and settings.
    *   `activeTab`: To interact with the currently active tab.
    *   `tabs`: To get information about open tabs and update them.
*   **Background Script**: `background.js` (Service Worker)
*   **Content Scripts**:
    *   `content.js`: Injected into all URLs (`<all_urls>`).
*   **Options UI**:
    *   `options.html`: A page for configuring the extension's settings.
*   **Host Permissions**:
    *   `<all_urls>`: Required for the content script to run on all pages and for the background script to potentially access tab URLs.

### Background Script (`background.js`)

The background script is the core of the extension, responsible for managing timers and blocking sites.

*   **Data Storage**:
    *   Domain timers are stored in `chrome.storage.local` under the key `domainTimers`.
    *   The data structure for each domain is an object: `{ originalTime: number, timeLeft: number, resetInterval: number, lastResetTimestamp: number, expiredMessageLogged: boolean }`.
    *   A default set of timers is provided for common social media sites.
*   **Timer Logic**:
    *   The script initializes by loading the timers from storage.
    *   It uses `chrome.tabs.onUpdated` to monitor for navigation to new pages.
    *   When a user navigates to a domain that is being tracked, a timer is started using `setInterval`.
    *   The timer decrements the `timeLeft` for the domain every 3 seconds.
    *   If `timeLeft` for a domain reaches zero, any further navigation to that domain will result in the tab being redirected to the new tab page (`chrome://newtab`).
*   **Timer Resets**:
    *   Timers are automatically reset after a configurable interval (`resetInterval`, in hours) has passed since the last reset.
    *   This check happens on every tab update.

### Content Script (`content.js`)

The content script is responsible for displaying a message on pages where the time has run out.

*   **Functionality**:
    *   On page load, it checks if the timer for the current domain has expired.
    *   If the time is up, it replaces the entire `<body>` of the page with an "Access Blocked" message.

### Options Page (`options.html` and `options.js`)

The options page provides a user interface for managing the blocked sites.

*   **Features**:
    *   Global reset interval setting that applies to all sites
    *   Add or update a timer for a specific domain using box-style radio buttons
    *   View a table of all configured domains with inline editing and save functionality
    *   Manually reset all timers to their original values
    *   Real-time timer updates without disrupting user interactions
*   **Implementation**:
    *   The page consists of three main sections: Global Settings, Add/Update form, and Tracked Sites table
    *   Box-style radio buttons provide predefined time values with visual feedback
    *   Table uses fixed column widths and percentage-based responsive layout
    *   Save buttons are integrated inline with time selection radio buttons
    *   JavaScript handles selective DOM updates to preserve user state during timer refreshes


# Feature: Time Tracking Analytics

Comprehensive time tracking system that records actual time spent on domains and displays analytics in multiple time buckets.

## Implementation Details

### Data Structure

#### Time Tracking Storage
```javascript
timeTracking: {
  'domain.com': {
    dailyTotals: {
      '2025-08-02': 3600,    // seconds spent on this date
      '2025-08-01': 1800,    // ISO date string as key
      '2025-07-31': 2400,
      // ... historical daily totals
    },
    allTimeTotal: 7800,      // total seconds since tracking started
    trackingStartDate: '2025-07-01',  // when tracking began for this domain
    lastResetDate: '2025-07-01',      // when tracking was last reset
    currentSessionStart: null,         // timestamp when current session started
    lastActiveTimestamp: 1691856000000 // last time domain was active (for cleanup)
  }
}
```

### Time Tracking Logic

#### Session Management
- **Session Start**: When user navigates to a tracked domain, record `currentSessionStart` timestamp
- **Session Update**: Every 5 seconds while domain is active, update session time
- **Session End**: When user navigates away or closes tab, calculate session duration and add to daily total
- **Idle Detection**: If no activity for 2 minutes, end current session

#### Daily Aggregation
- Store time in daily buckets for efficient storage and calculation
- Update `dailyTotals` for current date when sessions end
- Update `allTimeTotal` with session duration
- Clean up old daily data beyond 30 days automatically

#### Rolling Window Calculations
- **Last 24h**: Sum time from current partial day + previous day(s) within 24 hour window
- **Last 7d**: Sum daily totals for last 7 complete days + current partial day  
- **Last 30d**: Sum daily totals for last 30 complete days + current partial day
- **All Time**: Use stored `allTimeTotal` value

### Storage Considerations

#### Efficiency
- Store only daily totals, not individual sessions
- Automatic cleanup of data older than 30 days
- Estimated storage per domain: ~1KB for 30 days of daily data

#### Persistence
- Data stored in `chrome.storage.local` alongside existing timer data
- Survives extension reloads, browser restarts, and updates
- No external dependencies or cloud storage needed

### User Interface Changes

#### Options Table Enhancements
Add new columns to the tracked sites table:

| Column | Content | Width |
|--------|---------|-------|
| Domain | Existing | 15% |
| Time Allowed | Existing | 25% |
| Time Left | Existing | 10% |
| Last 24h | Time spent in last 24 hours | 10% |
| Last 7d | Time spent in last 7 days | 10% |
| Last 30d | Time spent in last 30 days | 10% |
| All Time | Total time spent since tracking started | 10% |
| Last Reset | Existing | 10% |
| Actions | Delete + Reset Tracking buttons | 10% |

#### New Functionality
- **Reset Tracking Button**: Individual reset per domain
- **Reset All Tracking Button**: Global reset for all domains
- **Time Format**: Display as "Xh Ym" for hours/minutes, "Xm Ys" for minutes/seconds

### Background Script Integration

#### Timer Integration
- Integrate time tracking with existing timer logic in `background.js`
- When timer is active for a domain, also track actual time spent
- Use existing tab monitoring events (`chrome.tabs.onUpdated`, `chrome.tabs.onActivated`)

#### Session Management
```javascript
// Extend existing handleTimerForTab function
async function handleTimerForTab(tab) {
  // ... existing timer logic ...
  
  // Add time tracking
  await trackTimeSession(domain, 'start');
}

// New time tracking functions
async function trackTimeSession(domain, action) { /* ... */ }
async function updateTimeTracking(domain, sessionDuration) { /* ... */ }
async function calculateTimeSpent(domain, period) { /* ... */ }
```

### Reset Functionality

#### Individual Domain Reset
- Clear `dailyTotals` for the domain
- Reset `allTimeTotal` to 0
- Update `lastResetDate` to current date
- Keep `trackingStartDate` for reference

#### Global Reset
- Reset tracking data for all domains
- Preserve domain timer settings (originalTime, timeLeft, etc.)
- Update all `lastResetDate` values

### System Overview

**Technical Features:**
- Rolling window analytics with daily aggregation
- Real-time session management with idle detection
- Comprehensive data model with automatic cleanup
- Professional user interface with live updates
- Robust error handling and data persistence

**User Benefits:**
- **Behavioral Insights**: Users can see actual vs. intended usage patterns
- **Data-Driven Decisions**: Analytics enable informed time limit adjustments
- **Progress Tracking**: Historical data shows improvement over time  
- **Flexible Reset**: Individual and global reset options provide fresh starts
- **Seamless Integration**: Analytics layer doesn't interfere with core blocking functionality

# Feature: Toolbar Popup

A compact browser-action popup that gives at-a-glance status and quick controls for the active tab without opening the full Options page.

## Purpose

The Options page is a full tab and is heavyweight for routine checks ("how much time do I have left on this site?") and quick actions ("block this site I just landed on", "pause blocking for a bit"). The popup fills that gap as the primary lightweight entry point to the extension.

## Manifest Integration

- Adds an `action` entry to the manifest with `default_popup` pointing at `popup.html` and a `default_title`.
- Reuses existing manifest `icons` for the toolbar button.
- No new permissions are required. The popup uses already-granted `tabs`/`activeTab` to read the current tab URL and `storage` to read/write timer and pause state.

## Popup UI (`popup.html` and `popup.js`)

- `popup.html` is a small fixed-width document styled to match the Options design system (same color palette and button styles). Styles are inline (allowed by the existing extension-pages CSP); logic lives in an external `popup.js`.
- `popup.js` loads shared helpers (`storage-utils.js`, `timer-utils.js`) the same way other entry points do.

### Displayed State

- Current domain (hostname of the active tab).
- Time left for that domain and a progress bar showing `timeLeft` relative to `originalTime`.
- The remaining time refreshes about once per second while the popup is open by re-reading storage (the background service worker is the single writer that decrements it).

### Controls

- **Block this site**: shown when the active tab is a trackable site that is not yet tracked. Adds the current hostname to `domainTimers` using a default time limit and the current global reset interval (inherited from existing domains, falling back to 24h). After adding, the popup refreshes to show the live timer.
- **Pause blocking (password-gated)**: when not paused, the popup shows a password input and a Pause button. The user must type the current pause password (which is only visible on the Options page). A correct entry sets `blockingPaused` to `true` and immediately rotates `pausePassword` to a new value. A wrong entry shows an error and does nothing.
- **Resume blocking**: when paused, the popup shows a one-click Resume button (no password required — re-enabling enforcement is always frictionless).
- **Options**: opens the full Options page.

### Empty / Edge States

- Untracked-but-trackable site: shows "not tracked yet" with the Block button available.
- Non-trackable page (e.g. `chrome://`, `chrome-extension://`, `about:`, blank): shows an informational message; only the Pause toggle and Options link remain meaningful.

## Pause Behavior

`blockingPaused` is a global boolean. When `true`:

- The background service worker does not start or decrement timers and does not redirect expired tabs.
- The content script does not replace page content with the blocked message.
- Pausing stops any active timer and ends active tracking sessions; resuming re-evaluates the current active tab.

Pause stays on until the user clicks Resume. Time tracking is not accrued while paused, consistent with timers not running.

## Pause Password (friction, not security)

Pausing is deliberately hard so it is a conscious choice rather than an impulse:

- A random `pausePassword` (a readable code such as `xxxx-xxxx-xxxx`) is generated on install and stored in `chrome.storage.local`. It is generated with `crypto.getRandomValues`.
- The password is shown **only** on the Options page, with a Copy button and a Regenerate button. To pause, the user must open Options, copy the current code, return to the popup, and enter it.
- On a successful pause the password **rotates** to a new value immediately, so every pause requires a fresh trip to the Options page — the code can never be memorized.
- This is a self-control friction device, not a security boundary; the value is stored in plaintext in local storage.
- The password generator is implemented as a pure function in `timer-utils.js` so it is unit-testable.

# Chrome Storage Data Models

This section documents all data structures stored in `chrome.storage.local` by the extension.

## Storage Buckets Overview

The extension uses two primary storage buckets:
- **`domainTimers`**: Core timer functionality and configurations
- **`timeTracking`**: Analytics data for actual time spent on domains

## 1. domainTimers

Primary storage for timer configurations and current state. This bucket contains the core functionality of the site blocker.

### Data Structure
```javascript
domainTimers: {
  'example.com': {
    originalTime: 300,              // number (seconds) - original time limit set by user
    timeLeft: 180,                  // number (seconds) - remaining time for current period
    resetInterval: 24,              // number (hours) - how often timer resets (1, 8, 24)
    lastResetTimestamp: 1691856000000,  // number (milliseconds) - when timer was last reset
    expiredMessageLogged: false     // boolean - prevents repeated console logging after expiration
  },
  'another-site.com': {
    originalTime: 600,
    timeLeft: 450,
    resetInterval: 24,
    lastResetTimestamp: 1691856000000,
    expiredMessageLogged: false
  }
  // ... additional domains
}
```

### Field Descriptions
- **`originalTime`**: The time limit (in seconds) that the user set for this domain. When timers reset, `timeLeft` is restored to this value.
- **`timeLeft`**: Current remaining time (in seconds) for this domain in the current reset period. Decrements while user is active on the domain.
- **`resetInterval`**: How often (in hours) the timer resets. Corresponds to the global reset interval setting.
- **`lastResetTimestamp`**: Unix timestamp (milliseconds) of when this domain's timer was last reset. Used to determine when next reset should occur.
- **`expiredMessageLogged`**: Boolean flag to prevent repeated console logging after timer expiration. Set to `true` after first expiration message, reset to `false` when timer resets.

### Default Domains
The extension initializes with these default domains on first install:
- `www.reddit.com`, `old.reddit.com` 
- `twitter.com`, `x.com`
- `instagram.com`, `www.instagram.com`

All default domains have:
- `originalTime: 60` (1 minute)
- `timeLeft: 60` (1 minute) 
- `resetInterval: 24` (24 hours)
- `lastResetTimestamp: Date.now()` (current time)
- `expiredMessageLogged: false` (logging enabled)

## 2. timeTracking

Analytics storage for tracking actual time spent on domains over different time periods. This data powers the time tracking analytics feature.

### Data Structure
```javascript
timeTracking: {
  'example.com': {
    dailyTotals: {
      '2025-08-02': 3600,           // number (seconds) - time spent on this date
      '2025-08-01': 1800,           // string key (ISO date) -> number value (seconds)
      '2025-07-31': 2400,
      // ... additional dates (automatically cleaned up after 30 days)
    },
    allTimeTotal: 7800,             // number (seconds) - total time since tracking started
    trackingStartDate: '2025-07-01', // string (ISO date) - when tracking began for this domain
    lastResetDate: '2025-07-01',    // string (ISO date) - when tracking was last manually reset
    currentSessionStart: null,       // number|null (timestamp) - start time of active session
    lastActiveTimestamp: 1691856000000 // number (timestamp) - last activity for idle cleanup
  }
  // ... additional domains
}
```

### Field Descriptions
- **`dailyTotals`**: Object mapping ISO date strings to seconds spent on that date. Used for rolling window calculations (24h, 7d, 30d).
- **`allTimeTotal`**: Total seconds spent on this domain since tracking started or last reset. Used for "All Time" column.
- **`trackingStartDate`**: ISO date string of when time tracking began for this domain. Set when domain is first visited.
- **`lastResetDate`**: ISO date string of when tracking data was last manually reset via "Reset Tracking" button.
- **`currentSessionStart`**: Unix timestamp (milliseconds) when current browsing session started, or `null` if no active session.
- **`lastActiveTimestamp`**: Unix timestamp (milliseconds) of last activity. Used for idle detection (sessions end after 2 minutes of inactivity).

### Session Management
- **Session Start**: Set when user navigates to tracked domain
- **Session End**: Triggered by navigation away, tab close, or idle timeout (2 minutes)
- **Daily Aggregation**: Session durations are added to `dailyTotals[currentDate]` and `allTimeTotal`
- **Data Cleanup**: Daily entries older than 30 days are automatically removed

### Rolling Window Calculations
- **Last 24h**: Sum of current partial day + previous days within 24-hour window
- **Last 7d**: Sum of daily totals for last 7 days + current active session time
- **Last 30d**: Sum of daily totals for last 30 days + current active session time  
- **All Time**: Direct value from `allTimeTotal` + current active session time

## 3. blockingPaused

Global flag controlling whether blocking enforcement is active. Powers the popup's "Pause all blocking" toggle.

### Data Structure
```javascript
blockingPaused: false  // boolean - when true, timers do not run and pages are not blocked
```

### Field Description
- **`blockingPaused`**: When `true`, the background service worker suspends timer countdown and tab redirects, and the content script skips the blocked-page message. Defaults to `false` and is initialized on first install. Set to `true` from the toolbar popup only after a correct password entry; cleared (Resume) with one click.

## 4. pausePassword

Random code that gates pausing from the popup. See "Pause Password" under the Toolbar Popup feature.

### Data Structure
```javascript
pausePassword: "7f3k-92qd-x8mn"  // string - current code required to pause; rotates after each pause
```

### Field Description
- **`pausePassword`**: A readable random code generated with `crypto.getRandomValues` on install. Displayed only on the Options page (with Copy/Regenerate). Required in the popup to set `blockingPaused` to `true`, and rotated to a new value on every successful pause and on manual Regenerate.

## Storage Management

### Initialization
- Extension initializes `domainTimers` with default domains on first install
- `timeTracking` is initialized as empty object `{}`
- Time tracking data is created per-domain when first visited

### Data Persistence
- All data persists across browser restarts and extension reloads
- No cloud storage or external dependencies
- Uses Chrome's local storage with automatic sync across devices

### Storage Efficiency
- Daily aggregation minimizes storage usage vs. storing individual sessions
- Automatic cleanup of data older than 30 days
- Estimated storage: ~1KB per domain for 30 days of tracking data

### Error Handling
- All storage operations wrapped in try/catch with fallback defaults
- Missing data returns sensible defaults (0 for time values, empty objects)
- Extension degrades gracefully if storage operations fail

---

# Technical Architecture

## Project Structure

The extension uses a clean, modular architecture:

### Core Files
- **`background.js`**: Service worker handling timer logic and time tracking
- **`options.js`**: Options page logic with async/await patterns
- **`content.js`**: Content script for blocked page display
- **`storage-utils.js`**: Shared storage utilities
- **`options.html`**: Modern, responsive options page UI

### Development Standards
- **Async/Await**: All storage operations use modern async patterns
- **Error Handling**: Comprehensive try/catch blocks with graceful fallbacks
- **Modularity**: Shared utilities and clear separation of concerns
- **Documentation**: Complete data model and API documentation
- **Testable Code**: Atomic functions suitable for unit testing

