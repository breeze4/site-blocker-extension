# Spending a token from the block page

## Parent spec

`docs/specs/2026-08-24-01-reset-tokens.md` — see "Spending a token", the
"Spending a token" data flow, and the "Analytics" rules.

## What to build

The payoff slice. A blocked page that holds a token offers a reset. One click
sends the spend to the worker, which refills the budget to its cap, clears the
token and the blocked flag, records the spend in tracking, and answers. The page
then returns the tab to the exact URL that was blocked.

The worker remains the only writer of timer state. Both refusals — no token, and
a budget already at its cap — live in the pure helper so every surface inherits
them.

## Goal

A blocked domain with a token can be reset in one click from the block page,
returning you to the page you were blocked from with a full budget, and the spend
is recorded.

## Type

AFK

## Blocked by

- Blocked by `2026-08-24-03-block-page.md`
- Blocked by `2026-08-24-04-earning-tokens.md`

## User stories addressed

- User story 3
- User story 9
- User story 15
- User story 16
- User story 23
- User story 31

## Acceptance criteria

- [x] `spendResetToken` sets `timeLeft` to `originalTime`, clears `resetToken`,
      clears `isBlocked`, and stamps `awaySince` to the injected current time, and
      reports the spend as successful.
- [x] `spendResetToken` refuses when no token is held, and refuses when `timeLeft`
      is at or above `originalTime`. Both refusals report failure and return the
      record unchanged, verified field by field.
- [x] A background integration test asserts a successful spend through the message
      dispatcher writes `domainTimers` and increments both today's entry in
      `resetTokenSpends` and `allTimeResetSpends` by one.
- [x] A background integration test asserts a refused spend writes neither record.
- [x] A unit test asserts a tracking record created fresh carries an empty
      `resetTokenSpends` map and a zero `allTimeResetSpends`, and that absent
      fields read as those defaults.
- [x] A unit test asserts the 30-day cleanup prunes `resetTokenSpends` entries
      older than the window and leaves `allTimeResetSpends` untouched.
- [x] A jsdom test asserts the block page shows the reset control when a token is
      held and hides it when none is held.
- [x] A jsdom test asserts a successful spend navigates the tab to the origin URL
      the page was given, and that a refused spend does not navigate.
- [x] `pnpm test` passes and `pnpm lint` reports no new errors.

## Owns

- `src/timer-utils.js` — new `spendResetToken` and its three export entries.
- `src/background.js` — the `spendResetToken` action in the
  `chrome.runtime.onMessage` dispatcher, a `recordResetTokenSpend` tracking
  helper, `createEmptyTimeTrackingRecord` (the two new fields), and
  `cleanupOldTimeTrackingData` (prune the new daily map).
- `src/blocked.html` — the reset control markup.
- `src/blocked.js` — the token read, the control's visibility, the click handler,
  and the return navigation.
- `tests/timer-logic.test.js` — spend helper coverage.
- `tests/background-integration.test.js` — dispatcher and tracking coverage.
- `tests/blocked-page.test.js` — control visibility and navigation coverage.
- `docs/SPEC.md` — the "Reset tokens" section and the `timeTracking` storage
  model.
- `AGENTS.md` — the storage model bullets.

## Must not touch

- `src/content.js`, `src/popup.*` — spend surfaces owned by
  `2026-08-24-06-spend-surfaces.md`.
- `src/options.*` — owned by `2026-08-24-07-options-token-ui.md`, including the
  display of spend counts.
- `grantResetTokenIfEarned` and the away clock — owned by
  `2026-08-24-04-earning-tokens.md`.

## Defines interfaces

- `spendResetToken` in `src/timer-utils.js` — consumed by plan `2026-08-24-06`.
- The `spendResetToken` message action and its response shape in
  `src/background.js` — consumed by plan `2026-08-24-06`.
- `resetTokenSpends` and `allTimeResetSpends` fields on each `timeTracking` entry
  — consumed by plan `2026-08-24-07`.

## Pattern exemplar

- **MUST follow the pattern in**: `src/timer-utils.js` — `applyTimerSettingsChange`
  is the model for a helper that returns both a record and an outcome flag. Match
  its return shape: an object carrying the updated timer data alongside the
  boolean, so callers never have to compare records to detect a change.
- **Follow the pattern in**: `src/background.js` — the existing
  `timerSettingsChanged` action shows how an action reads storage, acts, restarts
  the timer for the active tab, and answers through `sendResponse`.
- **Follow the pattern in**: `src/background.js` — `addSessionDurationToTracking`
  is the model for the spend counter: a small helper that folds one event into a
  daily map and an all-time total.

## Tasks

- [x] Add `spendResetToken` as a pure helper with both refusals, returning the
      updated record and a boolean outcome.
- [x] Add the two tracking fields to the empty-record factory and read them
      forgivingly wherever tracking records are consumed.
- [x] Add `recordResetTokenSpend`, folding one spend into today's entry and the
      all-time total.
- [x] Prune `resetTokenSpends` in the 30-day cleanup alongside the existing daily
      totals.
- [x] Add the `spendResetToken` action to the dispatcher: load timers, call the
      helper, and on success write timers, record the spend, and restart the timer
      for the active tab. Answer with the outcome either way.
- [x] Add the reset control to the block page, shown only when a token is held.
- [x] Wire the click handler to send the message and, on success, navigate to the
      origin URL.
- [x] Write the coverage listed in the acceptance criteria.
- [x] Update `docs/SPEC.md` and the storage bullets in `AGENTS.md`.
- [x] Run `pnpm test`, `pnpm lint`, and `pnpm format`.

## Implementation notes

The spend must go through the worker. The block page is not a writer of timer
state, and the single-writer rule is what keeps the countdown consistent across
the overlay, the popup, and the Options page. The page sends a message and
re-reads storage; it never writes `domainTimers` itself.

Refusing a spend at the cap is the only waste guard in the design. A top-up on a
full budget would consume the token and change nothing, so the helper rejects it.
A spend that gains only a little is allowed deliberately, per the resolved
decision on confirmation dialogs.

If the origin URL parameter is missing or fails to parse, the page states the
budget is restored and offers no navigation rather than guessing at a destination.
Do not fall back to the domain root: a fabricated destination is worse than none.

The response shape is consumed by the next plan's two surfaces, so keep it
minimal and explicit — the outcome and the reason for a refusal, nothing more.
