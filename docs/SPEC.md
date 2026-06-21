# Site Timer Blocker

A Manifest V3 Chrome extension for time-based website blocking with usage analytics. The goal is just-enough access to distracting sites — long enough to check what you came for, not long enough to sink an hour — backed by data on where the time actually goes.

This document describes the current behavior of the code. It is the source of truth; when a feature changes, update the relevant section here rather than appending notes.

## Architecture

Plain JavaScript, no bundler and no build step. The files under `src/` are what ship.

- `background.js` — service worker. The single source of truth for timer state: it watches tabs, runs the per-second countdown, blocks/redirects expired tabs, and accrues time-tracking sessions.
- `content.js` — content script on every page. Blocks an already-expired page on load, and renders the read-only time-left overlay while a tracked domain has time remaining.
- `popup.html` / `popup.js` — toolbar popup: at-a-glance status and quick actions for the active tab.
- `options.html` / `options.js` — full-page settings and the analytics dashboard.
- `storage-utils.js` — promisified `chrome.storage.local` get/set, shared by every surface.
- `timer-utils.js` — pure helpers (decrement, reset logic, URL/domain parsing, time formatting, pause-password generation), unit-tested in isolation.

Single-writer principle: only the background service worker writes `timeLeft`. Every other surface (content overlay, popup, options) reads storage and reflects it, and stays live by listening to `chrome.storage.onChanged` or re-reading on an interval. This avoids races and keeps the countdown consistent everywhere.

## Manifest (`manifest.json`)

- Manifest version 3.
- Permissions: `storage` (timers, tracking, settings), `activeTab` and `tabs` (read the active tab's URL, redirect on expiry).
- Host permissions: `<all_urls>` so the content script runs everywhere and the worker can read tab URLs.
- Background: `background.js` as a service worker.
- Content scripts: `storage-utils.js` then `content.js`, matched on `<all_urls>`, injected at `document_idle`.
- Action: `default_popup` is `popup.html` (the toolbar button).
- Options UI: `options.html`, opened in a full tab (`open_in_tab: true`).
- Content security policy for extension pages allows `'self'` scripts and inline styles only.

## Core behavior

### Timers and blocking

Per-domain timers live in `chrome.storage.local` under `domainTimers` (see Storage Data Models). A default set seeds common social sites on first install.

- The worker handles a tab on activation, navigation completion, and window-focus changes (`onActivated`, `onUpdated`, `onFocusChanged`). Concurrent handling is guarded so only one timer runs at a time.
- On each pass it opportunistically applies due resets, then, if the active tab's hostname is a tracked domain with positive time left, starts a `setInterval` that decrements `timeLeft` by one second.
- The countdown only runs while the browser is focused and the active tab is still on that domain. Switching tabs/domains, losing window focus, or pausing stops it.
- When `timeLeft` reaches zero, the worker stops the timer and redirects the active tab to `chrome://newtab`. Re-navigating to an expired domain redirects again.
- `content.js` independently blocks an already-expired page on load by replacing the page body with an "Access Blocked" message (covers a page that was open before expiry, or reopened while out of time).

### Reset intervals

- Each domain carries a `resetInterval` in hours (1, 8, or 24; default 24). When that long has passed since `lastResetTimestamp`, `timeLeft` is restored to `originalTime` on the next tab pass.
- The reset interval is a single global setting in Options: changing it rewrites `resetInterval` for every tracked domain.
- Options also offers a manual "Reset Timers" button that restores every domain's `timeLeft` immediately.

### Time-tracking analytics

Actual time spent per domain is recorded separately from the countdown, under `timeTracking`.

- A session begins (`currentSessionStart`) when the user lands on a tracked domain that still has time left. `lastActiveTimestamp` is refreshed every second while the timer ticks.
- A session ends — its duration added to `dailyTotals[today]` and `allTimeTotal` — when the user navigates away, switches tabs, closes the tab, the window loses focus, blocking is paused, or the session goes idle.
- Idle detection: a 30-second sweep ends any session whose `lastActiveTimestamp` is older than 2 minutes (the currently active, focused domain is exempt).
- Daily aggregation keeps only per-day totals, not individual sessions. Entries older than 30 days are pruned on startup.
- Rolling windows surfaced in Options — Last 24h / 7d / 30d — sum the relevant `dailyTotals` plus any current session; All Time uses `allTimeTotal` plus the current session.
- Tracking is not accrued while blocking is paused, consistent with timers not running.

### Options page (`options.html` / `options.js`)

The full-tab configuration and analytics surface.

- Add a domain via a single input that parses full URLs, partial URLs, or bare domains, previews the resulting hostname in real time, validates it (rejects IPs, `localhost`, malformed input), and warns on duplicates. The full hostname is kept, so subdomains are tracked separately.
- A table lists every tracked domain, sorted by base domain then subdomain, with columns: Domain, Time Allowed (inline time-limit radios + Save), Time Left, Last 24h, Last 7d, Last 30d, All Time, Last Reset, and Actions (Delete, Reset Tracking).
- Time-limit radios offer 1/5/10/30/60 minutes; Save is enabled only when the selection differs from storage, and on save the worker is notified to restart the active timer.
- Global controls: the reset-interval radios (apply to all domains), "Reset Timers", and "Reset All Tracking".
- Pause password panel shows the current code with Copy and Regenerate.
- The time columns refresh once per second without disturbing in-progress edits. A first-install onboarding banner shows when opened with `?onboarding=true`.

### Toolbar popup (`popup.html` / `popup.js`)

A compact browser-action popup — the lightweight everyday entry point — styled to match Options. It loads `storage-utils.js` and `timer-utils.js` like the other surfaces.

- Shows the active tab's hostname, its remaining time, and a progress bar of `timeLeft` against `originalTime`, refreshed about once per second while open.
- Block this site: shown for a trackable, not-yet-tracked page; adds the hostname to `domainTimers` with a default 5-minute limit and the reset interval inherited from existing domains (falling back to 24h).
- Pause / Resume: password-gated pause and one-click resume (see Pause).
- Edge states: a not-tracked-yet message with the Block button for trackable pages; an informational message for non-trackable pages (`chrome://`, `chrome-extension://`, `about:`, blank).

### Time-left overlay (`content.js`)

A passive, on-page indicator so remaining time is visible while browsing without opening the popup.

- A compact pill fixed to the top-right of the viewport, showing the remaining time (`M:SS`, or `Hh MMm` over an hour) and a thin progress bar of `timeLeft / originalTime`. The bar shifts green → amber → red as time depletes.
- Shown only for a tracked domain with positive finite `timeLeft`. Hidden when blocking is paused, the domain is untracked, or time has expired (the block/redirect logic handles that case).
- Updated live via `chrome.storage.onChanged` (the worker is the single writer that decrements each second) — no polling.
- Rendered inside a Shadow DOM host with a maximal z-index and `pointer-events: none`, so page styles can't affect it and it never intercepts clicks.

### Pause and pause password

- `blockingPaused` is a global boolean. While true, the worker runs no timers and performs no redirects, the content script skips both the block message and the overlay, and any active timer and tracking session are stopped. Resuming re-evaluates the current tab. Pause stays on until the user resumes.
- Pausing is gated by `pausePassword`: a readable random code (e.g. `xxxx-xxxx-xxxx`, generated with `crypto.getRandomValues` on install). The popup requires the current code to pause; a correct entry sets `blockingPaused` and immediately rotates the code to a new value. Resuming needs no password.
- The code is shown only on the Options page (Copy / Regenerate). The generator is a pure function in `timer-utils.js` so it is unit-testable. See Non-Goals for the rationale and security posture.

## Storage data models

All state lives in `chrome.storage.local`. It is per-device and per-profile; it is not `chrome.storage.sync` and does not sync across devices. All reads are wrapped in try/catch with sensible defaults so the extension degrades gracefully.

### `domainTimers`

Per-domain timer configuration and current state.

```jsonc
{
  "example.com": {
    "originalTime": 300,            // seconds — the limit the user set
    "timeLeft": 180,               // seconds — remaining this period
    "resetInterval": 24,           // hours — how often it resets (1, 8, 24)
    "lastResetTimestamp": 1691856000000, // ms — when it last reset
    "expiredMessageLogged": false  // dedupes the post-expiry debug log
  }
}
```

Defaults seeded on first install (all `originalTime`/`timeLeft` 60s, `resetInterval` 24h): `www.reddit.com`, `old.reddit.com`, `twitter.com`, `x.com`, `instagram.com`, `www.instagram.com`.

### `timeTracking`

Per-domain analytics, separate from the countdown.

```jsonc
{
  "example.com": {
    "dailyTotals": { "2025-08-02": 3600 }, // ISO date -> seconds that day
    "allTimeTotal": 7800,          // seconds since tracking started/last reset
    "trackingStartDate": "2025-07-01", // ISO date tracking began
    "lastResetDate": "2025-07-01", // ISO date of last manual tracking reset
    "currentSessionStart": null,   // ms timestamp, or null when idle
    "lastActiveTimestamp": 1691856000000 // ms — last activity, for idle sweep
  }
}
```

- `dailyTotals` powers the rolling windows; pruned past 30 days.
- A manual Reset Tracking clears `dailyTotals` and `allTimeTotal` and stamps `lastResetDate`, preserving `trackingStartDate`. Reset All Tracking does this for every domain. Neither touches timer settings.

### `blockingPaused`

Global boolean (default `false`). When true, no timers run and nothing is blocked. Initialized on install, set from the popup only after a correct password, cleared by Resume.

### `pausePassword`

String — the current code required to pause from the popup (e.g. `"7f3k-92qd-x8mn"`). Generated on install, rotated on every successful pause and on manual Regenerate.

## Non-Goals, Removed Features & Intentional Frictions

A single home for what the extension deliberately does not do, what was removed and why, and the design choices that are friction by intent — so these don't get re-litigated or scattered through the feature sections.

Removed
- Options link in the popup — removed so the pause password can only be retrieved by deliberately opening Options from `chrome://extensions` (Details → Extension options). This was a deliberate hardening of the pause friction.

Intentional frictions
- The popup never links to Options. Reading the pause password requires that manual trip every time.
- Pausing requires the current password and rotates it on use, so the code can never be memorized and each pause is a conscious act. Resuming is always frictionless (one click, no password) — re-enabling enforcement should never be hard.

Security posture
- The pause password is a self-control device, not a security boundary. It is stored in plaintext in local storage; anyone with access to the profile or devtools can bypass it. That is acceptable for the intended use.

Non-goals
- The time-left overlay is display-only: no controls, and no configuration UI for its position, size, or visibility. It never changes blocking, redirect, or tracking logic.
- No cloud sync, accounts, or external services; storage is local-only (not `chrome.storage.sync`). The extension has no runtime npm dependencies.
- Subdomains are tracked as distinct domains; there is no automatic subdomain grouping or base-domain rollup of limits.
