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