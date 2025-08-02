# Active Tasks

## Task List: Time Tracking Analytics Implementation

This checklist implements time tracking analytics following atomic, incremental, and always functional principles.

### Phase 1: Foundation Data Structure

- [ ] **1. Add Basic Time Tracking Storage Structure**
  - [ ] **1.1.** Add `timeTracking` object to storage initialization in `background.js`
  - [ ] **1.2.** Initialize empty timeTracking alongside existing domainTimers
  - [ ] **1.3.** Ensure extension remains fully functional after this storage addition

- [ ] **2. Create Time Tracking Utility Functions**
  - [ ] **2.1.** Add `getTimeTracking()` function to `background.js`
  - [ ] **2.2.** Add `saveTimeTracking()` function to `background.js`
  - [ ] **2.3.** Mirror the existing `getDomainTimers()` and `saveDomainTimers()` pattern
  - [ ] **2.4.** Verify storage functions work independently without breaking existing functionality

- [ ] **3. Add Domain Time Tracking Initialization**
  - [ ] **3.1.** Create `initializeDomainTimeTracking(domain)` function
  - [ ] **3.2.** Initialize tracking data structure for new domains when first encountered
  - [ ] **3.3.** Ensure function works when called but doesn't break existing timer logic

- [ ] **4. Add Session Start Tracking**
  - [ ] **4.1.** Extend `handleTimerForTab()` to record `currentSessionStart` timestamp
  - [ ] **4.2.** Only track session start, no session end logic yet
  - [ ] **4.3.** Verify existing timer functionality remains unchanged

- [ ] **5. Add Basic Session End Tracking**
  - [ ] **5.1.** Add session end logic when navigating away from tracked domains
  - [ ] **5.2.** Calculate basic session duration and store in memory (not persistent yet)
  - [ ] **5.3.** Ensure timer countdown and blocking logic still work correctly

- [ ] **6. Implement Daily Total Storage**
  - [ ] **6.1.** Add logic to save session duration to `dailyTotals` for current date
  - [ ] **6.2.** Update `allTimeTotal` when sessions end
  - [ ] **6.3.** Verify that time tracking data persists in storage without affecting timers

### Phase 2: Background Session Management

- [ ] **7. Add Idle Detection**
  - [ ] **7.1.** Implement 2-minute idle timeout to end sessions automatically
  - [ ] **7.2.** Track last activity timestamp and clear sessions when idle
  - [ ] **7.3.** Ensure idle detection doesn't interfere with existing timer intervals

- [ ] **8. Add Session Cleanup on Tab Close**
  - [ ] **8.1.** Handle `chrome.tabs.onRemoved` event to end sessions when tabs close
  - [ ] **8.2.** Ensure session data is saved before cleanup
  - [ ] **8.3.** Verify existing tab monitoring events still work properly

- [ ] **9. Add Automatic Data Cleanup**
  - [ ] **9.1.** Implement cleanup of daily data older than 30 days
  - [ ] **9.2.** Run cleanup during extension initialization
  - [ ] **9.3.** Ensure cleanup doesn't affect current day data or existing timers

- [ ] **10. Add Time Calculation Functions**
  - [ ] **10.1.** Create `calculateTimeSpent(domain, period)` for rolling window calculations
  - [ ] **10.2.** Support '24h', '7d', '30d', 'alltime' periods
  - [ ] **10.3.** Functions return correct values but aren't displayed in UI yet

### Phase 3: UI Table Structure

- [ ] **11. Add New Table Columns to HTML**
  - [ ] **11.1.** Add "Last 24h", "Last 7d", "Last 30d", "All Time" column headers to `options.html`
  - [ ] **11.2.** Adjust table column width percentages as specified in spec
  - [ ] **11.3.** Verify table layout remains functional and responsive

- [ ] **12. Update Table Row Generation**
  - [ ] **12.1.** Modify `renderDomainList()` to create cells for new time tracking columns
  - [ ] **12.2.** Display placeholder text (e.g., "Loading...") in new columns initially
  - [ ] **12.3.** Ensure existing table functionality (save, delete buttons) continues working

- [ ] **13. Add Time Formatting Function**
  - [ ] **13.1.** Create `formatTimeTracking(seconds)` function in `options.js`
  - [ ] **13.2.** Format as "Xh Ym" for hours/minutes, "Xm Ys" for minutes/seconds
  - [ ] **13.3.** Function works independently with various time values

- [ ] **14. Connect Time Tracking Data to Table Display**
  - [ ] **14.1.** Integrate time calculation functions with table rendering
  - [ ] **14.2.** Display actual time tracking data in the new columns
  - [ ] **14.3.** Verify all existing table operations (edit, save, delete) still work

### Phase 4: Reset Functionality

- [ ] **15. Add Individual Reset Tracking Button**
  - [ ] **15.1.** Add "Reset Tracking" button to each domain row in Actions column
  - [ ] **15.2.** Button appears next to existing Delete button
  - [ ] **15.3.** Button is visible but not functional yet, existing functionality preserved

- [ ] **16. Implement Individual Domain Reset Logic**
  - [ ] **16.1.** Add click handler for individual reset tracking buttons
  - [ ] **16.2.** Clear domain's time tracking data while preserving timer settings
  - [ ] **16.3.** Verify reset works correctly and table updates show zeroed time data

- [ ] **17. Add Global Reset All Tracking Button**
  - [ ] **17.1.** Add "Reset All Tracking" button to options page below existing "Reset Timers" button
  - [ ] **17.2.** Implement global reset functionality to clear all domain time tracking
  - [ ] **17.3.** Verify global reset preserves all timer configurations and settings

### Phase 5: UI Polish and Integration

- [ ] **18. Update Time Display Refresh Logic**
  - [ ] **18.1.** Modify `updateTimeDisplays()` to also refresh time tracking columns
  - [ ] **18.2.** Ensure time tracking displays update every second with current session time
  - [ ] **18.3.** Verify refresh doesn't disrupt user interactions or save button states

- [ ] **19. Add Time Tracking to New Domain Addition**
  - [ ] **19.1.** Ensure new domains added via form automatically get time tracking initialized
  - [ ] **19.2.** Verify tracking starts immediately when navigating to newly added domains
  - [ ] **19.3.** Confirm all existing add/update domain functionality works unchanged

- [ ] **20. Final Integration and Error Handling**
  - [ ] **20.1.** Add comprehensive error handling for all time tracking operations
  - [ ] **20.2.** Ensure graceful fallbacks if time tracking data is corrupted
  - [ ] **20.3.** Verify extension degrades gracefully if time tracking features fail

---

# Completed Task Archive

## ✅ Enlarge Options Window (Completed)
- Modified manifest.json to open options in full browser tab
- Verified proper functionality

## ✅ Box-Style Radio Button Interface (Completed)
- Implemented box-style radio buttons throughout the interface
- Added visual feedback states (default, hover, selected)
- Created consistent design language across all interactive elements
- Integrated inline save functionality

## ✅ Global Reset Interval System (Completed)  
- Added global reset interval setting at top of options page
- Simplified UI by removing per-domain reset interval controls
- Automatically applies setting to all existing and new domains
- Default 24-hour reset interval

## ✅ Table Improvements (Completed)
- Always-visible radio buttons in Time Allowed column
- Inline save buttons positioned next to radio button groups
- Fixed column widths with percentage-based responsive layout
- State preservation during automatic timer updates
- Optimized refresh logic to only update time displays

## ✅ UI/UX Enhancements (Completed)
- Unified button styling system (primary, secondary, delete)
- Consistent hover effects and transitions
- Professional appearance with cohesive color scheme
- Responsive design that adapts to screen size
- Improved accessibility with proper label associations

---

## Implementation Summary

The options page now features:
- **Three main sections**: Global Settings, Add/Update form, Tracked Sites table
- **Unified design**: Box-style radio buttons throughout
- **Real-time updates**: Timer display updates without disrupting user interactions
- **Simplified workflow**: Single global reset interval, inline editing with save buttons
- **Professional styling**: Consistent color scheme, typography, and interaction patterns
