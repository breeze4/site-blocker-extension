# Plan: Toolbar Popup with Password-Gated Pause

Spec: `docs/SPEC.md` → "Feature: Toolbar Popup"

## Goal

Add a browser-action popup as the lightweight entry point to the extension: glance at the
current site's remaining time, block the current site in one click, pause all blocking behind a
rotating password, and jump to the Options page. No new permissions required.

## Design Decisions

- New files: `src/popup.html` (inline styles matching the Options design system) and
  `src/popup.js` (external logic, loaded after `storage-utils.js` and `timer-utils.js`).
- Manifest gains an `action` with `default_popup: popup.html` and a `default_title`. Existing
  `icons` are reused for the toolbar button.
- New top-level storage keys, consistent with the existing flat keys:
  - `blockingPaused` (boolean, default `false`).
  - `pausePassword` (string, generated on install with `crypto.getRandomValues`).
- "Block this site" default: `originalTime` = 5 minutes (300s); `resetInterval` inherited from
  existing domains' current global value, falling back to 24h. Reuses domain validation.
- Popup refreshes the displayed time ~once per second by re-reading storage; the background
  service worker remains the single writer that decrements `timeLeft`.
- Pause is **password-gated and rotating**: the popup requires the current `pausePassword`
  (visible only on the Options page). A correct entry sets `blockingPaused = true` and rotates
  the password to a new value, so every pause requires a fresh trip to Options. Resume is one
  click with no password. While paused: no timer countdown, no redirect, no content-script block,
  no tracking accrual. This is a friction device, not security (plaintext local storage).
- The password generator is a pure function in `timer-utils.js` for unit-testability.
- Non-trackable pages (`chrome://`, `chrome-extension://`, `about:`, blank) show an
  informational state; only the pause/resume controls and Options remain meaningful.

## Tasks

Each task is atomic, builds on the previous one, and leaves the extension fully functional.

- [x] 1. Add `action.default_popup` to `manifest.json`; create minimal `popup.html` + `popup.js`
  shell showing the current domain and an "Options" button that opens the Options page.
- [x] 2. Popup: show the current domain's time left and a progress bar (`timeLeft` vs
  `originalTime`) using `formatTime`. Handle "not tracked" and "non-trackable page" states.
- [x] 3. Popup: live-update the time left and progress bar every second while open.
- [x] 4. Popup: "Block this site" button — for a valid, untracked, trackable domain, add it with
  the 5-minute default and inherited reset interval, then refresh. Hide/disable otherwise.
- [x] 5. Add `generatePausePassword()` to `timer-utils.js`; initialize `pausePassword` and
  `blockingPaused` in background `initialize()` (generate password if missing). No behavior change.
- [x] 6. Background + content: honor `blockingPaused` (skip countdown/redirect/content-block).
  React to pause-state changes via a `chrome.storage.onChanged` listener that stops the timer when
  paused and re-evaluates the active tab when resumed.
- [x] 7. Options page: show the current `pausePassword` (read-only) with Copy and Regenerate
  buttons; Regenerate writes a new value.
- [x] 8. Popup: pause UI — password input + Pause button. Correct password sets
  `blockingPaused = true` and rotates `pausePassword` (single storage write); wrong password
  shows an error. When paused, show a one-click Resume (no password) that clears the flag.
- [x] 9. Tests: jest coverage for `generatePausePassword`/`checkPausePassword`, popup pure
  helpers, and paused-skip background behavior. Full suite green.
- [x] 10. Docs: SPEC popup section confirmed; README feature list + structure refreshed.

## Review

Implemented as planned. Notable points:

- Pause-state propagation uses `chrome.storage.onChanged` rather than a custom runtime message.
  The popup just writes `blockingPaused`/`pausePassword`; the background reacts (stop timer on
  pause, re-evaluate the active tab on resume). Less coupling, single source of truth.
- Pause + password rotation is a single `setToStorage({ blockingPaused: true, pausePassword })`
  write, so the background sees one consistent change.
- No new permissions: `tabs`/`activeTab`/`storage` already cover reading the active tab and
  storage. Clipboard copy uses `navigator.clipboard` with an `execCommand` fallback.
- Tests: 105 → 126. New `tests/pause-feature.test.js` covers the password helpers and popup pure
  helpers; new background tests cover paused-skip and the storage-change pause path. The test
  harness gained `storage.onChanged` and a `crypto` (WebCrypto) shim.
- Packaging: `scripts/package.mjs` `EXTENSION_FILES` updated to ship `popup.html` / `popup.js`.

Lint: 0 errors (40 pre-existing-style warnings for empty `catch (error)` blocks, matching the
codebase convention). Prettier: clean.
