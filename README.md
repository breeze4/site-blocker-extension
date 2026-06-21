# Site Timer Blocker

A Chrome extension (Manifest V3) for time-based website blocking with usage analytics. Give yourself just enough time on distracting sites to check what you came for, without sinking an hour into them.

## Features

- Per-domain time limits with an automatic countdown while you're on a tracked site.
- Page blocking when a domain's time runs out, with configurable reset intervals (1h / 8h / 24h).
- On-page time-left overlay: a small, read-only pill showing the remaining time and a progress bar while you browse a tracked site.
- Toolbar popup for at-a-glance status, one-click "block this site", and a password-gated pause.
- Usage analytics: actual time spent per domain over rolling 24h / 7d / 30d / all-time windows, with idle detection.
- All data is stored locally in `chrome.storage.local` — no servers, no accounts.

## Install (development)

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the `src/` directory.

On first install the extension seeds default limits for common social sites and opens an onboarding tab.

## Project layout

```
src/                  Extension source (load this folder in Chrome)
  manifest.json       MV3 manifest
  background.js       Service worker: timer countdown, time tracking, blocking
  content.js          Content script: blocked-page message + time-left overlay
  options.html/.js    Full-page settings + analytics UI
  popup.html/.js      Toolbar popup (status, block this site, pause)
  storage-utils.js    chrome.storage.local wrappers (shared)
  timer-utils.js      Pure timer / format / validation helpers (unit-tested)
  icons/              Toolbar and store icons
docs/                 SPEC.md (source of truth), plans/, store + release docs
scripts/package.mjs   Builds the Chrome Web Store zip into dist/
tests/                Jest unit + integration tests
assets/               Icon source and generator
```

## Development

This project uses **pnpm**.

```
pnpm install        # install dev tooling
pnpm test           # run the Jest suite
pnpm lint           # eslint src/
pnpm format         # prettier --write src/
pnpm package        # build dist/ + store zip (requires the system `zip`)
```

There are no runtime npm dependencies — the extension ships the raw files under `src/`, with no bundler or build step. Everything in `devDependencies` is tooling (Jest, ESLint, Prettier).

## Documentation

- `docs/SPEC.md` — full feature and storage-model specification (the source of truth).
- `AGENTS.md` — orientation for AI coding agents and new contributors.
- `docs/CHROME_WEB_STORE_SUBMISSION.md`, `docs/RELEASE_CHECKLIST.md` — shipping.

## License

For personal use and educational purposes.
