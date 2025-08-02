# Chrome Extension Permissions Justification

## Required Permissions

### `storage`
**Purpose**: Store user configuration and time tracking data
**Usage**: 
- Save domain timer settings (time limits, reset intervals)
- Track usage analytics (time spent on sites)
- Store user preferences and settings
**Data**: All data stored locally in browser, no cloud sync

### `activeTab`
**Purpose**: Access current tab information for timer management
**Usage**:
- Get current tab URL to determine if timer should start
- Check domain against configured timer list
- Monitor active tab for timer functionality

### `tabs`
**Purpose**: Monitor tab navigation and redirect when time expires
**Usage**:
- Listen for tab updates to start/stop timers
- Redirect to new tab when site time limit is reached
- Track which tabs are active for time measurement

## Host Permissions

### `<all_urls>`
**Justification**: Required for core site blocking functionality
**Why Broad Permission Needed**:
1. **Universal Site Blocking**: Users can add any website to their timer list - we cannot predict which domains they'll want to block
2. **Content Script Injection**: Must inject blocking overlay on ANY site when time expires
3. **Tab Redirection**: Need permission to redirect users away from blocked sites
4. **Timer Enforcement**: Must monitor all domains to enforce time limits

**Privacy Commitment**:
- Extension does NOT read page content or user data from websites
- Only monitors domain names for timer management
- No data transmitted to external servers
- All data stored locally in user's browser

## Content Scripts

### `matches: ["<all_urls>"]`
**Purpose**: Display blocking message when site time expires
**Execution**: `document_idle` - runs after page fully loads
**Functionality**: Only replaces page content when timer has expired for that domain

## Security Notes

- No external network requests
- No data collection or analytics services
- Content Security Policy enforced
- All scripts and resources loaded locally
- No eval() or unsafe code execution