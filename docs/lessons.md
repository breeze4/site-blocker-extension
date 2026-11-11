# Lessons
Purpose: append-only record of session feedback captured during work in this repo, for later ingestion into rules and tooling.
Scope: process and workflow observations from any agent session; not code documentation.
Entry points: `docs/specs/`, `docs/plans/`, `AGENTS.md` — the artifacts these lessons are about
Related: `docs/SPEC.md` — the source of truth this repo's docs orbit; no router in this repo by design
Last-verified: 2026-08-24 — verified against current main
Status: current

### 2026-08-24 — correction — Interview length outran the size of the feature
Context: `2026-08-24-01-reset-tokens` spec, produced with the grill-me skill
The user asked "are we almost done with the grilling? this is a lot of questions
about a small feature" after roughly ten single-question rounds. Several rounds
covered decisions with an obvious default that could have been stated as a locked
choice with a one-line rationale, open to correction, rather than asked.
Proposed fix: in grill-me, state an expected question count up front and reserve
questions for forks where the options carry genuinely different consequences.

### 2026-08-24 — worked-well — Reading the code before the interview caught three design-breaking facts
Context: `2026-08-24-01-reset-tokens` spec, produced with the grill-me skill
Grepping the codebase before asking anything surfaced that `lastVisitTimestamp`
cannot serve as an away clock, that the popup has no domain context after a block
redirect, and that the recharge trickle makes blocks porous. Each one changed the
design, and none were in the user's feedback note.

### 2026-11-10 — correction — The work location changed twice mid-task
Context: task breeze4/site-blocker-extension#3, blocking hours per domain
The brief named a fresh clone on a feature branch. The operator then moved the
work to the existing `.cos/reading-copy` checkout, uncommitted, and deleted the
clone. For a change the operator wants to try in Chrome before review, the
target is the checkout that Chrome already loads.
Proposed fix: when a brief asks the operator to review a change in Chrome first,
confirm the target checkout and the commit policy before the first edit.

### 2026-11-10 — worked-well — A fake-clock worker harness covered window boundaries
Context: task breeze4/site-blocker-extension#3, `tests/blocking-hours.test.js`
Loading `background.js` in a `vm` context with a `chrome.alarms` mock and
`jest.setSystemTime` let the tests fire the boundary alarm and the countdown tick
on each side of 09:00 and 17:00 with local-time dates. The tests pass in any time
zone because they build dates with the local `Date` constructor.
