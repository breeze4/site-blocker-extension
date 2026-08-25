# Agent Guide

Orientation for AI coding agents (and humans) working in this repo. Read this
first, then `docs/SPEC.md` for the authoritative feature and data-model details.

## What this is

A Manifest V3 Chrome extension that limits time spent on chosen websites and
tracks usage. Plain JavaScript — **no bundler, no build step, no framework, no
runtime npm dependencies.** The files under `src/` are what ship; load `src/`
unpacked in Chrome to run it.

## Architecture

The background service worker is the single source of truth for timer state.

- `src/background.js` — service worker. Watches tab activation / navigation /
  focus, runs a 1-second `setInterval` that decrements `timeLeft` for the active
  tracked domain in storage, redirects expired tabs to `chrome://newtab`, and
  accrues time-tracking sessions (with idle detection). **It is the only writer
  that decrements `timeLeft`.** Other surfaces only read it.
- `src/blocked.html` / `blocked.js` — the block page shown when a domain's time is up or it is still below the re-entry floor.
- `src/content.js` — content script on `<all_urls>`. On load, sends a blockTab message to the worker (falling back to inline body swap) when the domain is expired; renders the read-only time-left overlay (a Shadow-DOM pill, top-right) while the domain is actively tracked. Stays live via `chrome.storage.onChanged`.
- `src/popup.html` / `popup.js` — toolbar popup: shows status, "block this site",
  and a link to the Options page. Re-reads storage once a second while open.
- `src/options.html` / `options.js` — full-page settings + analytics dashboard.
- `src/storage-utils.js` — promisified `chrome.storage.local` get/set. In page
  contexts (content/popup/options) it exposes `window.StorageUtils`; in the
  worker the functions are plain globals via `importScripts`.
- `src/timer-utils.js` — pure helpers (decrement, reset logic, URL/domain
  parsing, time formatting). Exported for both the
  browser (`window.TimerUtils` / worker global) and Node (`module.exports`) so
  they are unit-testable. **Keep new pure logic here and test it.**

## Storage model (in `chrome.storage.local`)

- `domainTimers` — per-domain `{ originalTime, timeLeft, rechargeRate, lastVisitTimestamp, expiredMessageLogged, isBlocked, resetToken, tokenThresholdHours, awaySince }` (seconds / hours / ms).
- `timeTracking` — per-domain daily totals + all-time + session bookkeeping.

Full field-by-field docs live in `docs/SPEC.md`.

## Conventions

- **Use pnpm**, never npm/npx. The only real dependencies are dev tooling.
- `pnpm test` (Jest + jsdom), `pnpm lint` (ESLint), `pnpm format` (Prettier).
  Run the tests before declaring a change done.
- Existing style uses `try { ... } catch (error) {}` for best-effort storage
  reads; ESLint reports these as warnings (not errors) — match the surrounding
  code rather than churning it.
- Code that may run under Node tests must guard browser-only globals
  (`typeof chrome !== "undefined"`, `typeof module !== "undefined"`), as
  `content.js` and `timer-utils.js` do.
- No manifest change is needed to read storage on a page — `content.js` already
  runs on `<all_urls>`.

## Build / package

`pnpm package` runs `scripts/package.mjs`, which copies the extension files into
`dist/` and produces a Chrome Web Store zip (needs the system `zip`). The
`EXTENSION_FILES` list in that script must stay in sync with `manifest.json`.
`dist/` and `node_modules/` are gitignored.

## Docs & process

- `docs/SPEC.md` is the source of truth — when you add a feature, add it to the
  spec (additively) in the right section.
- Plans live in `docs/plans/` as `YYYY-MM-DD-NN-slug.md`.
- Don't reintroduce removed cruft: there is intentionally no `docs/TASKS.md`,
  `docs/CLAUDE.md`, `docs/GEMINI.md`, or `docs/README.md`.
