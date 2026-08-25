# Step 1 — Remove pause: handoff

Removed the global pause feature and unearned top-ups per plan `docs/plans/2026-08-24-01-remove-pause.md`.

## Changes

- `src/storage-utils.js` — added `removeFromStorage` (accepts key or array, promisified with error handling), exported to all three environments.
- `src/timer-utils.js` — deleted `generatePausePassword`, `normalizePausePassword`, `checkPausePassword` from code and all export blocks.
- `src/background.js` — removed `blockingPaused` cached flag, `getBlockingPaused`, the pause gate in `handleTimerForTab`, the in-interval pause check, the `chrome.storage.onChanged` pause listener, and replaced `initialize`'s pause/password setup with a one-time cleanup removing both `blockingPaused` and `pausePassword` from storage.
- `src/content.js` — removed paused reads; `syncOverlay` now takes only `domainTimers`; storage listener watches only `domainTimers` changes.
- `src/popup.html` — removed pause section and styles; added "Open Options" muted footer button.
- `src/popup.js` — removed `renderPauseSection`, `handlePause`, `handleResume`; wired `openOptionsButton` to `chrome.runtime.openOptionsPage`.
- `src/options.html` — removed pause password panel and `resetTimersButton`.
- `src/options.js` — removed pause password management, `resetTimersButton` handler, and `loadPausePassword` call.
- `tests/pause-feature.test.js` → renamed to `tests/popup-helpers.test.js` — dropped password block, added `removeFromStorage` tests and Options-link wiring test.
- `tests/background-service-worker.test.js` — replaced three pause tests with one startup cleanup test asserting both dead keys are removed.
- `tests/options-integration.test.js` — removed three `resetTimersButton`-based tests and the fixture element.
- `tests/setup.js` — added `chrome.storage.local.remove`, `chrome.runtime.getManifest`, and `chrome.runtime.openOptionsPage` mocks.
- `docs/SPEC.md` — removed pause section, `blockingPaused`/`pausePassword` storage sections, and pause mentions throughout; added removal documentation to the Non-Goals section.
- `AGENTS.md` — removed pause-related storage model bullets and updated descriptions.
- `eslint.config.mjs` — added `removeFromStorage` as a global.

## Gating

- `pnpm test`: 129 passed, 6 suites
- `pnpm lint`: 0 errors, 37 pre-existing warnings
- `pnpm format:check`: clean
- Acceptance verify: 9/9 criteria pass (one residual fixture cleaned up pre-commit)

## Later steps

This slice leaves the extension with zero bypass. Steps 2–7 add the reset token economy as the single earned replacement.