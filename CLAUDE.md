# CLAUDE.md

The canonical project guide for agents lives in **[AGENTS.md](AGENTS.md)** — read
it first. It covers the architecture, storage model, conventions, and build/test
commands. This file only adds Claude Code–specific reminders so they aren't lost:

- Use **pnpm** (`pnpm test`, `pnpm lint`, `pnpm format`), never npm/npx.
- Run `pnpm test` and confirm it's green before declaring a change done.
- `docs/SPEC.md` is the source of truth — add new features to it additively.
- The background service worker is the only writer of `timeLeft`; other surfaces
  (content script, popup, options) read storage and reflect it.
