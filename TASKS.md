# Task List: Enlarge Options Window

This checklist outlines the steps to make the extension's options page open in a new tab.

- [x] **1. Modify Manifest File**
  - [x] **1.1.** Read the `manifest.json` file.
  - [x] **1.2.** Locate the `options_ui` object within the JSON structure.
  - [x] **1.3.** Change the value of the `open_in_tab` property from `false` to `true`.
  - [x] **1.4.** Save the changes to `manifest.json`.

- [x] **2. Verification**
  - [x] **2.1.** Reload the extension in the browser to apply the manifest changes.
  - [x] **2.2.** Navigate to the extension's options page.
  - [x] **2.3.** Confirm that the options page opens in a new, full-sized browser tab.

# Task List: Radio Button Input Controls

This checklist outlines the steps to replace number inputs with radio button groups for time allowed and reset interval fields.

- [ ] **1. Add CSS Styling for Radio Button Groups**
  - [x] **1.1.** Add CSS class for horizontal radio button group layout
  - [x] **1.2.** Add CSS styling for radio button spacing and alignment
  - [x] **1.3.** Add CSS styling for radio button labels
  - [x] **1.4.** Ensure radio buttons are visually consistent with existing form elements

- [ ] **2. Replace Time Allowed Input with Radio Buttons**
  - [x] **2.1.** Remove the existing number input for time allowed
  - [x] **2.2.** Add radio button group with values: 1 min, 5 min, 10 min, 15 min, 30 min, 1 hr, 2 hr
  - [x] **2.3.** Set default selection to 5 min
  - [x] **2.4.** Apply horizontal layout styling to the radio button group

- [ ] **3. Replace Reset Interval Input with Radio Buttons**
  - [x] **3.1.** Remove the existing number input for reset interval
  - [x] **3.2.** Add radio button group with values: 1 hr, 2 hr, 4 hr, 8 hr, 12 hr, 24 hr
  - [x] **3.3.** Set default selection to 8 hr
  - [x] **3.4.** Apply horizontal layout styling to the radio button group

- [ ] **4. Update Form Submission Logic**
  - [x] **4.1.** Modify form event listener to read radio button values instead of number inputs
  - [x] **4.2.** Convert radio button values to appropriate time units (minutes to seconds, hours to hours)
  - [x] **4.3.** Ensure form validation works with radio button selections
  - [x] **4.4.** Update form reset logic to clear radio button selections

- [ ] **5. Update Inline Editing Logic**
  - [x] **5.1.** Modify table editing to work with predefined radio button values
  - [x] **5.2.** Update save logic to handle radio button value conversions
  - [x] **5.3.** Ensure edited values map correctly to radio button options
  - [x] **5.4.** Handle edge cases where stored values don't match radio button options

- [ ] **6. Test Form Functionality**
  - [x] **6.1.** Test adding new domains with radio button selections
  - [x] **6.2.** Test editing existing domains through table interface
  - [x] **6.3.** Test form reset functionality
  - [x] **6.4.** Verify time values are stored and displayed correctly

# Task List: Apply Radio Buttons to Table Edits

This checklist outlines the steps to replace dropdown selects with radio button groups when editing values in the tracked sites table.

- [x] **1. Add CSS Styling for Table Radio Button Groups**
  - [x] **1.1.** Add CSS class for compact radio button groups in table cells
  - [x] **1.2.** Add styling for smaller radio buttons and labels suitable for table display
  - [x] **1.3.** Ensure radio button groups fit well within table cell constraints
  - [x] **1.4.** Test visual consistency with existing table styling

- [x] **2. Replace Time Allowed Dropdown with Radio Buttons**
  - [x] **2.1.** Modify the editable cell logic for originalTime field
  - [x] **2.2.** Create radio button group instead of select dropdown
  - [x] **2.3.** Set the closest matching option as selected
  - [x] **2.4.** Handle radio button change events for save button activation

- [x] **3. Replace Reset Interval Dropdown with Radio Buttons**
  - [x] **3.1.** Modify the editable cell logic for resetInterval field
  - [x] **3.2.** Create radio button group instead of select dropdown
  - [x] **3.3.** Set the closest matching option as selected
  - [x] **3.4.** Handle radio button change events for save button activation

- [x] **4. Test Table Radio Button Functionality**
  - [x] **4.1.** Test editing time allowed values using radio buttons
  - [x] **4.2.** Test editing reset interval values using radio buttons
  - [x] **4.3.** Verify save functionality works with radio button selections
  - [x] **4.4.** Test blur/cancel behavior with radio button groups

# Task List: Always-Visible Radio Buttons in Table

This checklist outlines the steps to make radio buttons always visible in table rows instead of requiring click-to-edit.

- [x] **1. Modify Table Rendering for Always-Visible Radio Buttons**
  - [x] **1.1.** Update renderDomainList to generate radio buttons for Time Allowed column
  - [x] **1.2.** Update renderDomainList to generate radio buttons for Reset Interval column
  - [x] **1.3.** Set correct radio button as selected based on stored values
  - [x] **1.4.** Apply appropriate CSS classes for table radio button display

- [x] **2. Update Radio Button Styling for Table Display**
  - [x] **2.1.** Adjust table-radio-group styling for always-visible display
  - [x] **2.2.** Ensure radio buttons fit well within table cell constraints
  - [x] **2.3.** Add consistent spacing and alignment for table radio buttons
  - [x] **2.4.** Test visual consistency across different table row states

- [x] **3. Refactor Save Button Logic**
  - [x] **3.1.** Remove click-to-edit event listeners for radio button columns
  - [x] **3.2.** Update save button logic to read always-visible radio button values
  - [x] **3.3.** Add change event listeners to radio buttons for save button activation
  - [x] **3.4.** Ensure save functionality works with persistent radio button state

- [x] **4. Remove Click-to-Edit Functionality**
  - [x] **4.1.** Remove editable class from Time Allowed and Reset Interval columns
  - [x] **4.2.** Update click event handler to skip radio button columns
  - [x] **4.3.** Clean up unused select dropdown creation code
  - [x] **4.4.** Remove blur/focus event handling for radio button columns

- [x] **5. Test Always-Visible Radio Button Functionality**
  - [x] **5.1.** Test that radio buttons are visible on page load for all table rows
  - [x] **5.2.** Test changing radio button values and saving changes
  - [x] **5.3.** Test adding new domains and verify radio buttons appear correctly
  - [x] **5.4.** Verify save button activation works with radio button changes

# Task List: Box-Style Radio Button Design and Save Button Relocation

This checklist outlines the steps to improve radio button styling with clickable boxes and move the save button to the Time Allowed column.

- [x] **1. Add CSS for Box-Style Radio Button Design**
  - [x] **1.1.** Hide default radio button inputs with CSS
  - [x] **1.2.** Style labels as clickable boxes with borders and padding
  - [x] **1.3.** Add selected state styling for active radio buttons
  - [x] **1.4.** Add hover state styling for better user feedback

- [x] **2. Update HTML Structure for Box Design**
  - [x] **2.1.** Modify radio button HTML to use label-wrapped design
  - [x] **2.2.** Ensure full label area is clickable for radio button selection
  - [x] **2.3.** Apply new CSS classes to radio button elements
  - [x] **2.4.** Maintain accessibility with proper label associations

- [x] **3. Move Save Button to Time Allowed Column**
  - [x] **3.1.** Remove save button from Actions column HTML generation
  - [x] **3.2.** Add save button to Time Allowed column after radio buttons
  - [x] **3.3.** Update save button positioning and styling for column integration
  - [x] **3.4.** Ensure save button state preservation works in new location

- [x] **4. Update Table Layout and Actions Column**
  - [x] **4.1.** Keep delete button in Actions column
  - [x] **4.2.** Update Actions column to only contain delete button
  - [x] **4.3.** Adjust table column widths for new save button placement
  - [x] **4.4.** Ensure responsive design works with updated layout

- [x] **5. Ensure Styling Works Within Table Constraints**
  - [x] **5.1.** Test box-style radio buttons fit well in table cells
  - [x] **5.2.** Verify styling is consistent across different screen sizes
  - [x] **5.3.** Ensure save button integrates well with radio button styling
  - [x] **5.4.** Check that all interactive elements remain accessible

# Task List: Global Reset Interval Cleanup

This checklist outlines the steps to simplify reset interval to a single global 24-hour setting and clean up the UI.

- [x] **1. Add Global Reset Interval Setting**
  - [x] **1.1.** Add global reset interval radio buttons at top of options page
  - [x] **1.2.** Set default global reset interval to 24 hours
  - [x] **1.3.** Style global reset interval with same box design as form radio buttons
  - [x] **1.4.** Add event listener to save global reset interval changes

- [x] **2. Remove Reset Interval from Table**
  - [x] **2.1.** Remove reset interval column from table headers
  - [x] **2.2.** Update table rendering to skip reset interval column creation
  - [x] **2.3.** Remove reset interval radio buttons from table rows
  - [x] **2.4.** Update table layout to accommodate removed column

- [x] **3. Update Save Logic for Global Reset Interval**
  - [x] **3.1.** Modify table save logic to use global reset interval setting
  - [x] **3.2.** Update form submission to apply global reset interval to new domains
  - [x] **3.3.** Remove reset interval from individual domain save operations
  - [x] **3.4.** Ensure global setting applies to all existing domains

- [x] **4. Clean Up CSS and HTML**
  - [x] **4.1.** Remove unused reset interval CSS from table styling
  - [x] **4.2.** Update form HTML to remove individual reset interval controls
  - [x] **4.3.** Clean up JavaScript to remove reset interval table logic
  - [x] **4.4.** Simplify table structure without reset interval complexity

- [x] **5. Update State Preservation Logic**
  - [x] **5.1.** Remove reset interval from table state preservation
  - [x] **5.2.** Add global reset interval to options page state management
  - [x] **5.3.** Ensure global setting persists across page reloads
  - [x] **5.4.** Update save button logic to only handle time allowed changes
