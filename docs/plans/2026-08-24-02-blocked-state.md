# Blocked state and the re-entry floor

## Parent spec

`docs/specs/2026-08-24-01-reset-tokens.md` — see "Blocking and re-entry" and the
resolved decisions for the re-entry floor and the stored blocked flag.

## What to build

Make a block hold. Today a domain becomes reachable again the instant recharge
credits one second, which at the default rate happens about every two minutes.
This slice introduces a stored `isBlocked` flag, set when the countdown reaches
zero and cleared only when recharge brings the budget to 10% of its cap. The
access decision moves behind a single pure predicate.

No user interface changes here. A blocked tab still goes to the browser's new tab
page; the block page arrives in the next slice.

## Goal

A domain that runs out of time stays blocked until its budget recharges to 10% of
its cap, and a session already in progress is never cut short by that floor.

## Type

AFK

## Blocked by

- Blocked by `2026-08-24-01-remove-pause.md`

## User stories addressed

- User story 25
- User story 26

## Acceptance criteria

- [ ] `reEntryFloor` returns 10% of `originalTime`, returns 0 for a missing or
      non-finite cap, and is unit-tested at a 60-second cap (6) and a 300-second
      cap (30).
- [ ] `updateBlockedState` sets `isBlocked` when `timeLeft` is at or below zero,
      clears it when `timeLeft` is at or above the floor, and leaves it unchanged
      between those bounds. Unit tests cover 9% blocked, exactly 10% cleared, and
      an unchanged mid-band value.
- [ ] `canAccessDomain` returns false when `isBlocked` is true even with positive
      `timeLeft`, and false when `timeLeft` is zero or negative.
- [ ] A unit test asserts a record with `isBlocked` absent derives the flag from
      `timeLeft <= 0`.
- [ ] A background integration test asserts a running session with `timeLeft`
      below the floor is not blocked, proving the floor never interrupts an
      in-progress visit.
- [ ] A background integration test drives a timer to zero, confirms `isBlocked`
      is set, credits recharge below the floor and confirms the domain is still
      denied, then credits past the floor and confirms it is allowed.
- [ ] The seeded default domains carry `isBlocked: false`.
- [ ] `pnpm test` passes and `pnpm lint` reports no new errors.

## Owns

- `src/timer-utils.js` — new `reEntryFloor`, `updateBlockedState`, and
  `canAccessDomain`, plus their entries in all three export blocks; the
  `expiredMessageLogged` handling inside `applyRecharge` where it overlaps the new
  flag.
- `src/background.js` — `applyRechargeToAllTimers` (call `updateBlockedState` per
  domain after crediting), the expiry branch inside the countdown interval (set
  the flag before stopping and redirecting), the access decision in
  `handleTimerForTab` (replace the bare `timeLeft > 0` test with
  `canAccessDomain`), and `defaultDomainTimers`.
- `tests/timer-logic.test.js` — new helper coverage.
- `tests/background-integration.test.js` — blocked-state lifecycle coverage.
- `tests/background-service-worker.test.js` — seeded default assertions.
- `docs/SPEC.md` — the "Timers and blocking" section and the `domainTimers`
  storage model.

## Must not touch

- `src/content.js` — the block path is owned by `2026-08-24-03-block-page.md`.
- `src/background.js` redirect targets and the message dispatcher — owned by
  `2026-08-24-03-block-page.md`.
- Token fields and helpers — owned by `2026-08-24-04-earning-tokens.md`.
- `src/popup.*` and `src/options.*` — owned by later plans.

## Defines interfaces

- `isBlocked` field on each `domainTimers` entry — consumed by plans
  `2026-08-24-03`, `2026-08-24-05`, and `2026-08-24-07`.
- `reEntryFloor`, `updateBlockedState`, and `canAccessDomain` in
  `src/timer-utils.js` — consumed by plans `2026-08-24-03` and `2026-08-24-05`.

## Pattern exemplar

- **MUST follow the pattern in**: `src/timer-utils.js` — `applyRecharge` is the
  model for the new helpers: take a timer record and an optional injected
  timestamp, normalize every field defensively, return a new object rather than
  mutating, and never trust stored values to be finite.
- **Follow the pattern in**: `tests/timer-logic.test.js` — the existing recharge
  tests show the boundary-case style, including injected timestamps and
  backwards-clock guards.

## Tasks

- [ ] Add `reEntryFloor`, `updateBlockedState`, and `canAccessDomain` as pure
      helpers with forgiving reads, and export them three ways.
- [ ] Add unit tests for each helper, covering both boundaries of the floor and
      the mid-band no-op.
- [ ] Set `isBlocked` in the countdown's expiry branch, before the session stop
      and the redirect.
- [ ] Call `updateBlockedState` for every domain inside
      `applyRechargeToAllTimers`, after crediting recharge.
- [ ] Replace the access test in `handleTimerForTab` with `canAccessDomain`.
- [ ] Add `isBlocked: false` to the seeded defaults.
- [ ] Add the background integration coverage for the lifecycle and the
      mid-session case.
- [ ] Update `docs/SPEC.md`.
- [ ] Run `pnpm test`, `pnpm lint`, and `pnpm format`.

## Implementation notes

The flag has to be stored rather than computed. A live comparison of `timeLeft`
against the floor would deny access the moment a running session's remaining time
fell below 10%, ending the visit early. The flag is set only by the transition to
zero, and cleared only by recharge reaching the floor or by a token spend in a
later slice.

`applyRecharge` already re-arms `expiredMessageLogged` when it lifts a budget
above zero. Keep that behavior and add the blocked-state update alongside it
rather than folding one into the other; they answer different questions and the
tests read better separated.

The countdown's expiry branch and the already-expired branch of
`handleTimerForTab` both navigate to `chrome://newtab`. Leave both
targets exactly as they are in this slice — the next plan replaces them.
