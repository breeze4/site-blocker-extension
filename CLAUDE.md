# CLAUDE.md

The canonical project guide for agents lives in **[AGENTS.md](AGENTS.md)** — read
it first. It covers the architecture, storage model, conventions, and build/test
commands. This file only adds Claude Code–specific reminders so they aren't lost:

- Use **pnpm** (`pnpm test`, `pnpm lint`, `pnpm format`), never npm/npx.
- Run `pnpm test` and confirm it's green before declaring a change done.
- `docs/SPEC.md` is the source of truth — add new features to it additively.
- The background service worker is the only writer of `timeLeft`; other surfaces
  (content script, popup, options) read storage and reflect it.

<!-- cos:managed-project:start -->
## Reading copy

This section applies only when the file `.cos/reading-copy` exists in this checkout. If that file doesn't exist, ignore this section.

When `.cos/reading-copy` exists:

- This checkout is a reading copy of the project `site-blocker-extension`, which the chief of staff owns on beebaby.
- The git hooks in this checkout reject every commit and push.
- To change the project, ask the chief of staff. Or run `cos eject site-blocker-extension` here, make the change, and run `cos migrate site-blocker-extension` when you finish.
<!-- cos:managed-project:end -->
