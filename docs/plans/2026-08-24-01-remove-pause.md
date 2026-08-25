# Remove pause and the unearned top-ups

## Parent spec

`docs/specs/2026-08-24-01-reset-tokens.md` — see "Pause removal" and the
"Resolved decisions" entries for pause, the Options link, and "Reset All Timers".

## What to build

Strip every escape hatch that is not earned. The global pause and its password
disappear from storage, the worker, the popup, the Options page, and the content
script. The unconditional "Reset All Timers" button disappears from Options. The
popup regains its link to the Options page, because the friction that justified
removing it guarded the pause password and nothing else.

After this slice the extension has no bypass at all. That is the intended
intermediate state: later slices add the reset token as the single earned
replacement.

## Goal

Blocking cannot be disabled or unconditionally refilled by any user action, and
no pause state remains in code or in local storage.

## Type

AFK

## Blocked by

None - can start immediately.

## User stories addressed

- User story 1
- User story 27
- User story 28
- User story 30

## Acceptance criteria

- [ ] `grep -ri "paus" src/ tests/ docs/SPEC.md` returns no matches.
- [ ] `grep -rn "resetTimersButton\|Reset All Timers" src/ tests/` returns no matches.
- [ ] `pnpm test` passes with every suite green.
- [ ] `pnpm lint` reports no new errors beyond the pre-existing empty-catch warnings.
- [ ] A unit test asserts the storage remove helper resolves for a single key and
      for an array of keys, and rejects on `chrome.runtime.lastError`.
- [ ] A background test asserts startup removes both `blockingPaused` and
      `pausePassword` from local storage.
- [ ] `tests/popup-helpers.test.js` exists and still covers `isTrackableUrl`,
      `getDomainFromUrl`, `getInheritedRechargeRate`, `getProgressPercent`, and
      the default-block-minutes constant. `tests/pause-feature.test.js` no longer
      exists.
- [ ] `src/popup.html` contains a control that calls `chrome.runtime.openOptionsPage`,
      and a popup test asserts the handler is wired.
- [ ] The content script's overlay sync takes no paused argument, and its tests
      pass without one.

## Owns

- `src/timer-utils.js` — `generatePausePassword`, `normalizePausePassword`,
  `checkPausePassword`, and their entries in all three export blocks.
- `src/background.js` — the `blockingPaused` module variable, `getBlockingPaused`,
  the pause gate near the top of `handleTimerForTab`, the pause check inside the
  countdown interval, the `blockingPaused` branch of the `chrome.storage.onChanged`
  listener, and the pause and password setup in `initialize`.
- `src/content.js` — the paused reads in `init`, the `paused` parameter of
  `syncOverlay`, and the `blockingPaused` handling in the storage listener.
- `src/popup.html` — the `pauseSection` markup and the pause-related styles; add
  the Options link.
- `src/popup.js` — `renderPauseSection`, `handlePause`, `handleResume`, their
  listener registrations in `init`, and the Options link handler.
- `src/options.html` — the pause password panel and the `resetTimersButton`
  control with its help text.
- `src/options.js` — `setPausePasswordStatus`, `loadPausePassword`, the copy and
  regenerate listeners, the `loadPausePassword` call at the bottom of the file,
  and the `resetTimersButton` listener.
- `src/storage-utils.js` — new `removeFromStorage`, exported the same three ways
  as the existing helpers.
- `tests/pause-feature.test.js` — rename to `tests/popup-helpers.test.js` and drop
  only the password block.
- `tests/background-service-worker.test.js` — the pause references.
- `tests/timer-logic.test.js` — any password helper coverage.
- `docs/SPEC.md` — the "Pause and pause password" section, the `blockingPaused`
  and `pausePassword` storage sections, the pause and Options-link entries under
  "Non-Goals, Removed Features & Intentional Frictions", and the pause mentions in
  the popup, Options, overlay, and tracking sections.
- `AGENTS.md` — the storage model bullets naming `blockingPaused` and
  `pausePassword`.

## Must not touch

- `src/blocked.html`, `src/blocked.js` — created by `2026-08-24-03-block-page.md`.
- `src/background.js` redirect targets and the `chrome.runtime.onMessage`
  dispatcher body — owned by `2026-08-24-03-block-page.md`.
- `src/timer-utils.js` recharge and blocked-state helpers — owned by
  `2026-08-24-02-blocked-state.md`.
- The Options global controls panel layout and the recharge radios — restructured
  by `2026-08-24-07-options-token-ui.md`.
- `scripts/package.mjs` — owned by `2026-08-24-03-block-page.md`.

## Defines interfaces

- `removeFromStorage` in `src/storage-utils.js` — consumed by plan
  `2026-08-24-01` only at present; available to later plans.

## Pattern exemplar

- **MUST follow the pattern in**: `src/storage-utils.js` — `removeFromStorage`
  mirrors `getFromStorage` and `setToStorage` exactly: a promise wrapper that
  rejects on `chrome.runtime.lastError`, exported to `window.StorageUtils`, to the
  worker global, and to `module.exports` by the same branch structure.
- **Follow the pattern in**: `tests/pause-feature.test.js` — the surviving popup
  helper block is the style for the renamed file.

## Tasks

- [ ] Add `removeFromStorage` to the storage utilities, accepting a key or an
      array of keys, with all three exports updated.
- [ ] Delete the three password helpers from the timer utilities and remove them
      from the Node, window, and worker export blocks.
- [ ] Remove the pause gate, the cached flag, `getBlockingPaused`, the in-interval
      pause check, and the storage-listener branch from the worker.
- [ ] Replace the pause and password setup in `initialize` with a one-time cleanup
      that removes both dead keys through `removeFromStorage`.
- [ ] Drop the paused reads and the `paused` parameter from the content script,
      simplifying `syncOverlay` to take only the timer map.
- [ ] Remove the popup pause panel, its handlers, and its styles; add an Options
      link that calls `chrome.runtime.openOptionsPage`.
- [ ] Remove the Options password panel, its handlers, and the "Reset All Timers"
      button and handler.
- [ ] Rename the pause test suite to `tests/popup-helpers.test.js`, delete the
      password describe block and the WebCrypto shim, and keep the popup helper
      coverage intact.
- [ ] Add coverage for `removeFromStorage` and for the startup key cleanup.
- [ ] Update `docs/SPEC.md` and the storage bullets in `AGENTS.md`.
- [ ] Run `pnpm test`, `pnpm lint`, and `pnpm format`.

## Implementation notes

The renamed test file opens with a WebCrypto shim that exists only for
password generation. Remove the shim along with the password block.

The popup's Options link cannot be a plain anchor to `options.html`: the Options
page is declared with `open_in_tab`, so use a button whose handler calls
`chrome.runtime.openOptionsPage()`. Style it as a muted footer control rather than
a primary button, so it does not compete with "Block this site".

`docs/SPEC.md` records two intentional frictions built around the password — the
popup's missing Options link, and the password rotation on use. Both entries move
to the removed list with their reason, rather than being deleted silently.
