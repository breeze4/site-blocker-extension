# Tasks: Toolbar Popup with Password-Gated Pause

Plan: `docs/plans/2026-06-18-01-toolbar-popup.md`

- [x] 1. Add `action.default_popup` to `manifest.json`; minimal `popup.html` + `popup.js` shell
  (current domain + "Options" button that opens the Options page).
- [x] 2. Popup: show time left + progress bar (`timeLeft` vs `originalTime`); handle "not tracked"
  and "non-trackable page" states.
- [x] 3. Popup: live-update time left + progress bar every second while open.
- [x] 4. Popup: "Block this site" button — add current domain (5 min default, inherited reset
  interval), then refresh; hide/disable when already tracked or page non-trackable.
- [x] 5. Add `generatePausePassword()` (plus `normalizePausePassword`/`checkPausePassword`) to
  `timer-utils.js`; initialize `pausePassword` and `blockingPaused` in background `initialize()`.
- [x] 6. Background + content honor `blockingPaused` (skip countdown/redirect/content-block);
  react to pause-state changes via a `chrome.storage.onChanged` listener.
- [x] 7. Options page: show current `pausePassword` with Copy + Regenerate buttons.
- [x] 8. Popup: pause UI — password input + Pause (correct password pauses + rotates code), and
  one-click Resume when paused.
- [x] 9. Tests: jest coverage for password generation, check/rotate, popup pure helpers, and
  paused-skip background behavior; full suite green (126 tests).
- [x] 10. Docs: SPEC updated; README feature list + structure refreshed; packaging script updated.
