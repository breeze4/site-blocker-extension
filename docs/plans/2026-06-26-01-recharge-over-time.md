# Plan: Recharge over time (replace reset model)

GitHub issue: #1 — `feat: Recharge over time`
Spec: `docs/SPEC.md` → "Recharge over time" section, `domainTimers` storage model.

## Goal

Replace the periodic hard-reset budget (`resetInterval` / `lastResetTimestamp`,
once-per-1/8/24h restore to full) with a continuously recharging budget keyed to
time away from the site. Being on the site spends; being away earns. Rate is a
global setting: 30s/1m/2m/5m/10m/15m restored per hour, default 30s/hr.

## Decisions (locked)

- Recharge is keyed to time since the domain was last the active focused tab
  (`lastVisitTimestamp`), not wall-clock/calendar.
- No accrual while the domain is the active tab — even when idle on the page.
- Reset model is removed entirely, not kept as an alternate mode.
- Rate ladder: 30s, 1m, 2m, 5m, 10m, 15m per hour (stored as seconds-per-hour:
  30, 60, 120, 300, 600, 900). Default 30s/hr.
- Budget starts full when a domain is added (unchanged from today); recharges
  from wherever it currently sits, capped at `originalTime`.
- Expired domains (`timeLeft` 0) recharge back above zero and become usable again
  gradually — this is the whole point, no cliff-edge restore.
- Storage migration is forgiving (read-time defaults), no data wipe.

## Slice 1 — Core pure helper + unit tests (`src/timer-utils.js`, `tests/timer-logic.test.js`)

The testable heart of the feature. Do this first and prove it in isolation.

- [x] Add `applyRecharge(timerData, currentTime = Date.now())` per the spec
      pseudocode: no-op when full; credit `floor(elapsed * rechargeRate/3.6e6)`
      whole seconds; cap at `originalTime`; advance `lastVisitTimestamp` only by
      the time the credited seconds consumed (carry the remainder).
- [x] Default a missing/invalid `rechargeRate` to 30 and a missing
      `lastVisitTimestamp` to `currentTime` inside the helper (forgiving reads).
- [x] Remove `checkAndResetIfIntervalPassed` and its three `module.exports` /
      global export references.
- [x] Update `applyTimerSettingsChange` to stamp `lastVisitTimestamp` (not
      `lastResetTimestamp`) and carry `rechargeRate` instead of `resetInterval`.
- [x] Add a `formatRechargeRate`/`estimateTimeUntilFull` pure helper (seconds
      until `timeLeft` reaches `originalTime` at the current rate) for the
      Options "Full In" column; export it.
- [x] Unit tests: no-op when full; partial credit under cap; cap clamp; remainder
      carried across two successive calls (no lost fractional time); zero/garbage
      `rechargeRate` falls back to 30; expired (0) climbs back above 0;
      `estimateTimeUntilFull` math + "Full" case.
- [x] `pnpm test tests/timer-logic.test.js` green.

## Slice 2 — Background worker (`src/background.js`, `tests/background-*.test.js`)

- [x] Seeded defaults (6 domains): replace `resetInterval: 24` /
      `lastResetTimestamp` with `rechargeRate: 30` / `lastVisitTimestamp`.
- [x] Rename `resetTimersIfNeeded` → `applyRechargeToAllTimers`; call
      `TimerUtils.applyRecharge` per domain (keep the inline fallback in sync, or
      drop the fallback if `TimerUtils` is always present after `importScripts`).
- [x] In the per-second tick for the active domain, set
      `lastVisitTimestamp = now` each second so no recharge accrues during a
      visit and the away-clock starts fresh on departure.
- [x] Confirm recharge is credited on the tab pass **before** the block/redirect
      decision (it already runs at the top of the pass — line ~426).
- [x] Update `tests/background-service-worker.test.js` and
      `tests/background-integration.test.js` (~57 refs): new field names, recharge
      accrual on pass, active-tab timestamp refresh, expired→usable recovery.
- [x] `pnpm test tests/background-service-worker.test.js tests/background-integration.test.js` green.

## Slice 3 — Options page (`src/options.html`, `src/options.js`, `tests/options-integration.test.js`)

- [x] Global control: swap the reset-interval radios for recharge-rate radios
      (30s/1m/2m/5m/10m/15m per hour). Update label/help text + the global-apply
      handler that rewrites every domain's `rechargeRate`.
- [x] Table: rename the "Last Reset" column (`th:nth-child(8)`, header, and the
      per-row cell) to "Full In"; render `estimateTimeUntilFull` (or "Full").
- [x] Update the once-per-second refresh to recompute "Full In" alongside
      "Time Left" without disturbing in-progress edits.
- [x] Add-domain + inline-save paths: write `rechargeRate` /
      `lastVisitTimestamp` instead of `resetInterval` / `lastResetTimestamp`.
- [x] Keep "Reset All Timers" (manual top-up to cap) working.
- [x] Update `tests/options-integration.test.js` (~55 refs).
- [x] `pnpm test tests/options-integration.test.js` green.

## Slice 4 — Popup (`src/popup.js`)

- [x] "Block this site" inherits `rechargeRate` from existing domains (fallback
      30) and stamps `lastVisitTimestamp`; rename `getInheritedResetInterval`.
- [x] No new UI — popup already reads `timeLeft`. Spot-check the progress bar
      against `originalTime` still works.

## Slice 5 — Migration & packaging sweep

- [x] Verify forgiving reads everywhere: any code path reading `resetInterval` /
      `lastResetTimestamp` either maps to the new fields or is removed. Grep for
      both names across `src/` returns nothing (except intentional migration
      fallback).
- [x] `scripts/package.mjs` `EXTENSION_FILES` unchanged (no new files) — confirm.
- [x] No `manifest.json` change needed — confirm.

## Verification

- [x] `pnpm test` fully green.
- [x] `pnpm lint` clean (match existing warning posture; no new errors).
- [x] `pnpm format` applied.
- [ ] Manual load-unpacked smoke (optional, NOT done): set 1m budget + 15m/hr;
      spend it to zero; confirm the page blocks; wait/clock-advance and reconfirm
      it becomes usable again as `timeLeft` recharges; confirm "Full In" counts down.

## Review

Shipped. Reset model fully removed; recharge model in place across worker, options,
popup, and pure helpers.

What landed:
- `timer-utils.js`: `checkAndResetIfIntervalPassed` removed; added pure
  `applyRecharge`, `estimateSecondsUntilFull`, `normalizeRechargeRate`.
  `applyTimerSettingsChange` now carries `rechargeRate` / `lastVisitTimestamp`.
- `background.js`: `resetTimersIfNeeded` → `applyRechargeToAllTimers` (credits
  away-time before the block decision); seeds use `rechargeRate: 30`; the active
  tab refreshes `lastVisitTimestamp` each tick so it never recharges while in use.
- `options.{html,js}`: recharge-rate radios (30s/1m/2m/5m/10m/15m per hour,
  default 30s/hr); "Last Reset" column → "Full In", projected read-only so away
  domains reflect the refilling budget without violating single-writer.
- `popup.js`: inherits `rechargeRate`; constant/ helper renamed.
- Storage: `resetInterval`→`rechargeRate`, `lastResetTimestamp`→`lastVisitTimestamp`,
  read forgivingly (defaults), no data wipe.

Verification: `pnpm test` 138/138 green across 6 suites; `pnpm lint` 0 errors
(only pre-existing best-effort-catch `error` warnings, per house style);
`pnpm format` applied. Tests updated across all 5 suites; the
`checkAndResetIfIntervalPassed` unit block was rewritten as `applyRecharge` /
`estimateSecondsUntilFull` coverage (cap clamp, remainder carry, backwards-clock
guard, rate default). Manual browser smoke not performed.

Closes #1.
