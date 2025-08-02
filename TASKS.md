# Options Page Overhaul - Incremental Checklist

This checklist breaks down the options page overhaul into small, atomic tasks. After each step, the extension's options page will be in a working, testable state.

### Phase 1: Display Existing Data in a Table
*   [x] **1.1.** In `options.html`, replace the `<ul id="domainList"></ul>` with an empty table structure: `<table><thead>...</thead><tbody id="domainListBody"></tbody></table>`. The table headers should be "Domain", "Time Allowed (sec)", "Time Left (sec)", "Reset Interval (hr)", and "Last Reset".
*   [x] **1.2.** In `options.js`, modify the `renderDomainList` function. Instead of creating `<li>` elements, it will now create `<tr>` and `<td>` elements to populate the new table body (`#domainListBody`). The data format will remain the same for now.

### Phase 2: Refactor "Add/Update" to Use the Table
*   [x] **2.1.** In `options.html`, replace the old `<form>` with a new, more intuitive form for adding/updating domains. It will have inputs for "Domain", "Time Allowed", and "Reset Interval".
*   [x] **2.2.** In `options.js`, update the `'submit'` event listener to read from the new form's input fields. The logic will still add/update the entry in `chrome.storage` and then call `renderDomainList` to refresh the table.

### Phase 3: Add Deletion Capability
*   [x] **3.1.** In `options.js` (`renderDomainList`), add a new column to the table called "Actions". In each row, add a "Delete" button.
*   [x] **3.2.** In `options.js`, create a function that handles the "Delete" button click. It should identify the domain for that row, remove it from `chrome.storage.local`, and then call `renderDomainList` to update the view.

### Phase 4: Implement Inline Editing and Saving
*   [x] **4.1.** In `options.js` (`renderDomainList`), add a "Save" button to the "Actions" column for each row, initially disabled.
*   [x] **4.2.** In `options.js`, add event listeners to the "Time Allowed" and "Reset Interval" cells (`<td>`). When a user clicks on one of these cells, it should transform into an `<input>` field containing the current value.
*   [x] **4.3.** In `options.js`, when the value of an inline `<input>` field changes, the "Save" button for that row should become enabled.
*   [x] **4.4.** In `options.js`, implement the "Save" button's click handler. It will read the new values from the input fields in its row, update the data in `chrome.storage.local`, and re-render the table. The "Save" button should become disabled again after a successful save.

### Phase 5: Final Polish
*   [x] **5.1.** In `options.js`, convert time units for display. The "Time Allowed" and "Time Left" columns should be displayed in minutes, not seconds, for better readability. The underlying data in storage will remain in seconds.
*   [x] **5.2.** In `options.html`, add some basic CSS to improve the table's appearance (e.g., borders, padding, consistent button styling).
*   [x] **5.3.** Review all new code and add comments where necessary to clarify complex logic.