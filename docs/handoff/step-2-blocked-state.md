# Step 2 — Blocked state: handoff

Introduced a stored `isBlocked` flag and the 10% re-entry floor per plan `docs/plans/2026-08-24-02-blocked-state.md`.

## Changes

- `src/timer-utils.js` — added `reEntryFloor`, `updateBlockedState`, `canAccessDomain` pure helpers with forgiving reads and exports to all three environments.
- `src/background.js` — `isBlocked: false` on all six seeded defaults; `applyRechargeToAllTimers` calls `updateBlockedState` per domain after crediting recharge; `handleTimerForTab` replaces the bare `timeLeft > 0` with `canAccessDomain`; countdown expiry branch and the already-expired branch both set `isBlocked = true` before redirecting.
- `tests/timer-logic.test.js` — 16 new tests covering reEntryFloor (5 tests), updateBlockedState (5 tests including immutability), and canAccessDomain (6 tests including null guard and absent-field derivation).
- `tests/background-integration.test.js` — two lifecycle tests: full zero→floor→above cycle, and mid-session-below-floor-not-blocked.
- `tests/background-service-worker.test.js` — seeded-default assertion now includes `isBlocked: false`.
- `docs/SPEC.md` — `domainTimers` storage model docs `isBlocked`; Timers section documents the re-entry floor.

## Gating

- `pnpm test`: 144 passed, 6 suites
- `pnpm lint`: 0 errors, 39 warnings (pre-existing)
- `pnpm format:check`: clean

## Interface provided for later steps

- `isBlocked` field on `domainTimers` entries — consumed by plans 03, 05, 07.
- `reEntryFloor`, `updateBlockedState`, `canAccessDomain` in timer-utils.js — consumed by plans 03 and 05.