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
