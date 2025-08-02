# Site Blocker extension

When you want very limited access to sites, just enough to view random links you come across, but no so much you can waste a lot of time.

## Features:
* Can add/remove domains and associated timers
* Shows a block page when a domain has run out of time
* Stops the timer when you navigate from a page
* Starts the timer when you navigate to a domain
* When the time expires and you're on the page, so far nothing happens; if you navigate within that domain, it will send you to a blank page
* Timers reset after an interval has passed, configurable
* TODO: support subdomains automatically

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
    *   The data structure for each domain is an object: `{ originalTime: number, timeLeft: number, resetInterval: number, lastResetTimestamp: number }`.
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

# Feature: Enlarge Options Window

## 1. Problem

The extension's options page currently opens in a small, popup window. This provides a poor user experience, as the content, especially the new table layout, feels cramped and requires scrolling.

## 2. Solution

The options page will be configured to open in a standard, full-sized browser tab. This will provide ample space for the user interface, improving readability and usability.

## 3. Technical Implementation

The change will be implemented by modifying the extension's manifest file.

*   **File:** `manifest.json`
*   **Key:** `options_ui`
*   **Property:** `open_in_tab`
*   **Value Change:** The value of `open_in_tab` will be changed from `false` to `true`.

## 4. Expected Outcome

When a user accesses the extension's options, the `options.html` page will open in a new browser tab, utilizing the full window size.

# Feature: Box-Style Radio Button Interface

## 1. Problem

The extension needed a more intuitive and visually appealing interface for time selection, with better user experience and consistent design across all interactive elements.

## 2. Solution

Implemented a comprehensive box-style radio button system with:
- Hidden radio inputs with styled clickable label boxes
- Visual feedback states (default, hover, selected)
- Consistent design language across all form elements
- Inline save functionality for immediate access

## 3. Technical Implementation

### Global Reset Interval Setting
- Single setting at top of options page that applies to all sites
- Values: 1 hr, 2 hr, 4 hr, 8 hr, 12 hr, 24 hr
- Default selection: 24 hr
- Automatically updates all existing domains when changed

### Form Radio Buttons
- Time Allowed values: 1 min, 5 min, 10 min, 15 min, 30 min, 1 hr, 2 hr
- Box-style design with green selection states
- Default selection: 5 min

### Table Integration
- Always-visible radio buttons in Time Allowed column
- Inline save buttons positioned next to radio button groups
- State preservation during automatic timer updates
- Fixed column widths with percentage-based responsive layout

### Visual Design System
- Primary buttons (green) for main actions
- Secondary buttons (blue) for supporting actions  
- Delete buttons (red) for destructive actions
- Consistent hover effects and transitions

## 4. Current Implementation

The interface now features:
- Three main sections: Global Settings, Add/Update form, Tracked Sites table
- Unified box-style radio buttons throughout
- Real-time updates that don't disrupt user interactions
- Professional appearance with consistent styling
- Responsive layout that adapts to screen size

# Feature: Async/Await Storage Refactor

## 1. Problem

The codebase currently uses callback-based `chrome.storage.local` operations throughout `options.js` and `content.js`, leading to:
- Nested callback chains that reduce code readability
- Inconsistent error handling patterns
- Complex async control flow that's hard to maintain
- Mix of callback and async patterns across different files

## 2. Solution

Modernize all storage operations to use async/await pattern for:
- Improved code readability and maintainability
- Consistent error handling with try/catch blocks
- Simplified async control flow
- Unified approach across all extension files

## 3. Technical Implementation

### Current State Analysis
- **background.js**: Already has async wrappers (`setToStorage`, `getFromStorage`) ✅
- **options.js**: 8 `chrome.storage.local.get` + 5 `chrome.storage.local.set` operations using callbacks
- **content.js**: 1 `chrome.storage.local.get` operation using callback

### Implementation Approach
1. Create shared storage utility functions (reuse existing background.js patterns)
2. Convert all storage operations in options.js to async/await
3. Convert content.js storage operation to async/await  
4. Test functionality and clean up callback code

### Functions to Convert
- Form submission handler
- `renderDomainList()` function
- Table save button handler
- Delete button handler
- Reset timers handler
- Global reset interval change handler
- Page load initialization
- `updateTimeDisplays()` function
- Content script domain check

## 4. Expected Outcome

- All storage operations will use consistent async/await pattern
- Improved code readability with flattened async flow
- Better error handling throughout the application
- Modernized codebase following current JavaScript standards

# Feature: Time Tracking Analytics

## 1. Problem

Users want to understand their actual usage patterns beyond just the time limits. They need visibility into:
- How much time they've actually spent on tracked domains over different time periods
- Historical usage patterns to make informed decisions about time limits
- Ability to reset tracking data when starting fresh

Currently, the extension only tracks remaining time against limits, but doesn't provide analytics on actual time spent.

## 2. Solution

Implement a comprehensive time tracking system that records actual time spent on domains and displays analytics in multiple time buckets:
- Last 24 hours (rolling window)
- Last 7 days (rolling window) 
- Last 30 days (rolling window)
- All time (since tracking started or last reset)

## 3. Technical Implementation

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

### Implementation Phases

#### Phase 1: Data Structure & Background Tracking
- Implement time tracking data structure
- Add session management to background script  
- Store daily totals automatically

#### Phase 2: UI Integration
- Add new columns to options table
- Implement time calculation and display
- Add individual reset buttons

#### Phase 3: Global Controls
- Add global reset functionality
- Add bulk time tracking controls
- Polish UI and add responsive behavior

## 4. Expected Outcome

Users will have comprehensive visibility into their actual time usage patterns:
- **Behavioral Insights**: See actual vs. intended usage patterns
- **Data-Driven Decisions**: Adjust time limits based on real usage data  
- **Progress Tracking**: Monitor improvements over time
- **Flexible Reset**: Start fresh when needed without losing timer configurations

The feature will integrate seamlessly with existing timer functionality while providing valuable analytics for informed digital wellness decisions.