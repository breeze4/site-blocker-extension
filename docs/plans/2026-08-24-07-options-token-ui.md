# Options token controls and column

## Parent spec

`docs/specs/2026-08-24-01-reset-tokens.md` — see "Surfaces" for the grouped
controls and the tenth column, and "Analytics" for the spend counts.

## What to build

The settings and reporting surface for the token economy. The global controls
panel presents recharge rate and token threshold under one heading, because both
reward the same behavior at different scales: recharge is the slow drip, a token
is the lump sum for a long absence.

The domain table gains a tenth column showing whether a domain's token is ready or
how long the wait is, with the 30-day spend count beneath it. That column is the
only place the token economy is legible at rest, and it exists because Options is
a deliberate visit rather than ambient browsing.

## Goal

The Options page lets you set the absence threshold for every domain and shows,
per domain, whether a token is ready and how often you have spent one.

## Type

AFK

## Blocked by

- Blocked by `2026-08-24-05-spending-tokens.md`

## User stories addressed

- User story 20
- User story 21
- User story 22
- User story 24

## Acceptance criteria

- [x] The domain table renders 10 header cells in this order: Domain, Time
      Allowed, Time Left, Last 24h, Last 7d, Last 30d, All Time, Full In, Reset
      token, Actions. A test asserts the header text in order.
- [x] The column-width rules target the new positions: the Reset token column is
      the ninth child and Actions is the tenth. A test asserts a rendered row has
      10 cells with Actions last.
- [x] The Reset token cell reads "Ready" when a token is held, and otherwise the
      remaining wait derived from `secondsUntilTokenReady`. Tests cover both.
- [x] The Reset token cell shows the 30-day spend count for the domain, and shows
      it as zero for a domain with no recorded spends.
- [x] Choosing a token threshold rewrites `tokenThresholdHours` for every tracked
      domain and notifies the worker, verified the same way the recharge-rate
      group is verified.
- [x] The threshold group initializes from stored data on load, falling back to 8
      when domains disagree or none exist.
- [x] Adding a domain writes `tokenThresholdHours`, `resetToken: false`,
      `isBlocked: false`, and an `awaySince` timestamp alongside the existing
      fields.
- [x] Reset Tracking, for one domain and for all domains, clears
      `resetTokenSpends` and `allTimeResetSpends` while preserving
      `trackingStartDate`, and a test asserts timer settings are untouched.
- [x] The once-per-second refresh updates the Reset token cell alongside Time Left
      and Full In, and a test asserts an in-progress time-limit edit is not
      disturbed by the refresh.
- [x] `pnpm test` passes and `pnpm lint` reports no new errors.

## Owns

- `src/options.html` — the global controls panel heading and layout, the new
  threshold radio group, the table header row, and the `nth-child` column rules.
- `src/options.js` — `renderDomainList` (the new cell), `updateTimeTrackingCells`
  and `updateTimeDisplays` (refresh the new cell), a global threshold change
  listener alongside the recharge listener, an initializer for the threshold
  group, `createResetTimeTrackingRecord` (clear the spend counts), and the
  add-domain submit handler.
- `tests/options-integration.test.js` — all new coverage.
- `docs/SPEC.md` — the Options page section.

## Must not touch

- `src/timer-utils.js` — every helper this plan needs already exists. If one
  appears to be missing, stop and re-read plans `2026-08-24-04` and
  `2026-08-24-05`.
- `src/background.js`, `src/content.js`, `src/popup.*`, `src/blocked.*` — owned by
  earlier plans.
- The recharge-rate radio values and behavior — only their heading and grouping
  change here.

## Defines interfaces

None. This plan consumes the timer helpers, the `domainTimers` token fields, and
the `timeTracking` spend fields defined by earlier plans.

## Pattern exemplar

- **MUST follow the pattern in**: `src/options.js` — the global recharge-rate
  group is the exact model for the threshold group: a radiogroup in the markup, a
  change listener that rewrites the field across every domain and notifies the
  worker, and an initializer that reads current storage to select the right radio.
- **MUST follow the pattern in**: `src/options.html` — the existing "Full In"
  column shows how a computed, non-editable cell is declared, styled by
  `nth-child`, and refreshed.
- **Follow the pattern in**: `tests/options-integration.test.js` — the existing
  recharge-rate and column tests set the style for storage mocking and assertion.

## Tasks

- [x] Group the recharge-rate radios and a new token-threshold radiogroup under
      one heading that names what they share, with help text for each.
- [x] Add the threshold change listener and the initializer, mirroring the
      recharge-rate pair.
- [x] Add the Reset token header between Full In and Actions, and shift the
      column-width rules by one.
- [x] Render the new cell with the token state and the 30-day spend count.
- [x] Include the new cell in the once-per-second refresh.
- [x] Write the new fields in the add-domain path.
- [x] Clear both spend fields in the tracking reset record factory.
- [x] Write the coverage listed in the acceptance criteria.
- [x] Update `docs/SPEC.md`.
- [x] Run `pnpm test`, `pnpm lint`, and `pnpm format`.

## Implementation notes

The column shift is the mechanical risk in this plan. The stylesheet
targets `th:nth-child(8), td:nth-child(8)` for Full In and
`th:nth-child(9), td:nth-child(9)` for Actions, each with a trailing comment
naming the column. Reset token takes position 9 and Actions moves to 10, so the
Actions rule becomes `nth-child(10)` and a new rule appears for `nth-child(9)`.
Update the trailing comments with the rules; a stale comment naming the wrong
column is how the next reader gets this wrong.

Grep for every `nth-child` occurrence in the Options markup and for any
cell-index arithmetic in the row renderer and the refresh path before changing
anything. A row built by index rather than by name breaks silently when a column
is inserted in the middle.

The threshold radios carry hour values of 4, 8, 12, and 24, stored as
`tokenThresholdHours` in hours, not seconds. The recharge radios store
seconds-per-hour. Two different units sit side by side in one panel, so label
both explicitly.

Both controls are global in effect and per-domain in storage. Rewriting every
domain on change is the established behavior for the recharge rate; match it
rather than introducing a separate global key.
