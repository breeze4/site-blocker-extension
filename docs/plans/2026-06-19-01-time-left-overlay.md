# Plan: Time-Left Overlay

Spec: see "Feature: Time-Left Overlay" in `docs/SPEC.md`.

A read-only, on-page pill showing remaining time for the current tracked site. No
controls — just the countdown text and a proportional progress bar. Rendered by the
existing content script, kept live via `chrome.storage.onChanged` (the background is
the single writer that decrements `timeLeft` each second).

## Tasks

- [ ] Add pure helpers to `content.js`: `formatRemaining`, `remainingPercent`,
      `urgencyColor`, `getCurrentDomain`. Export them for unit tests. App unchanged.
- [ ] Build the Shadow DOM overlay (`buildOverlay`/`renderOverlay`/`removeOverlay`)
      and a `syncOverlay(domainTimers, paused)` decision function. Wire it into the
      on-load `init`, preserving the existing block-on-expiry behavior.
- [ ] Add the guarded `chrome.storage.onChanged` listener so the overlay updates
      live and hides on pause/expiry.
- [ ] Unit tests for the pure helpers; verify the existing block test still passes.

## Decisions

- Overlay text is a compact countdown (`M:SS`, or `Hh MMm` over an hour); the bar
  is the percent indicator. Both are present, no label cruft.
- Style isolation via Shadow DOM; host is `position:fixed`, max z-index,
  `pointer-events:none` so it never intercepts page clicks.
- Live updates come from storage change events, not a polling interval.
- No manifest change: `content.js` already runs on `<all_urls>` and reads storage.
