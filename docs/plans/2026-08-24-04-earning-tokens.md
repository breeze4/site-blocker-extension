# Earning reset tokens

## Parent spec

`docs/specs/2026-08-24-01-reset-tokens.md` — see "Earning a token", the "Granting
a token" data flow, and the "Existing data" rules.

## What to build

The earning half of the token economy, with no user interface. Each domain gains
an away clock, a threshold, and a single-token flag. The worker grants the token
on its existing tab pass once the domain has been left alone for the full
threshold, and refreshes the away clock every second while the domain is the
active focused tab, so any visit restarts the absence.

Verification is by unit and integration tests plus storage inspection. The
surfaces that show and spend the token arrive in the next slices.

## Goal

A domain that has been left alone for its full threshold holds exactly one reset
token, and any visit inside the threshold restarts the clock without taking a
token already held.

## Type

AFK

## Blocked by

- Blocked by `2026-08-24-02-blocked-state.md`

## User stories addressed

- User story 2
- User story 4
- User story 5
- User story 6
- User story 7
- User story 8
- User story 29
- User story 33

## Acceptance criteria

- [ ] `normalizeTokenThresholdHours` returns 8 for missing, zero, negative,
      non-finite, and non-numeric input, and returns 4, 8, 12, and 24 unchanged.
- [ ] `grantResetTokenIfEarned` grants at exactly the threshold, does not grant one
      millisecond before it, and does not grant twice — a second call on a record
      that already holds a token returns it unchanged.
- [ ] A unit test asserts a grant happens when `timeLeft` equals `originalTime`,
      proving a full budget does not block a grant.
- [ ] A unit test asserts a backwards clock jump never grants a token.
- [ ] Unit tests assert the forgiving reads: `resetToken` absent reads false,
      `tokenThresholdHours` absent reads 8, and `awaySince` absent falls back to
      `lastVisitTimestamp` and then to the injected current time.
- [ ] `secondsUntilTokenReady` returns 0 when a token is held, and otherwise
      returns the whole seconds remaining in the threshold, never negative.
- [ ] A background integration test asserts the countdown refreshes `awaySince`
      for the active domain on every tick, so an active domain never accrues
      toward a token.
- [ ] A background integration test asserts a visit at partway through the
      threshold restarts the clock, and that the same visit leaves an
      already-held token in place.
- [ ] The seeded default domains carry `resetToken: false`, `tokenThresholdHours: 8`,
      and an `awaySince` timestamp.
- [ ] `pnpm test` passes and `pnpm lint` reports no new errors.

## Owns

- `src/timer-utils.js` — new `normalizeTokenThresholdHours`,
  `grantResetTokenIfEarned`, and `secondsUntilTokenReady`, plus their entries in
  all three export blocks.
- `src/background.js` — `applyRechargeToAllTimers` (call
  `grantResetTokenIfEarned` per away domain), the countdown interval (refresh
  `awaySince` for the active domain each second, alongside the existing
  `lastVisitTimestamp` refresh), and `defaultDomainTimers`.
- `tests/timer-logic.test.js` — new helper coverage.
- `tests/background-integration.test.js` — grant and away-clock coverage.
- `tests/background-service-worker.test.js` — seeded default assertions.
- `docs/SPEC.md` — a new "Reset tokens" section and the `domainTimers` storage
  model.
- `AGENTS.md` — the storage model bullets.

## Must not touch

- `spendResetToken` and the spend counters — owned by
  `2026-08-24-05-spending-tokens.md`.
- `shouldOfferOverlayReset` — owned by
  `2026-08-24-06-spend-surfaces.md`.
- `src/blocked.*`, `src/content.js`, `src/popup.*`, `src/options.*` — owned by
  other plans.

## Defines interfaces

- `resetToken`, `awaySince`, and `tokenThresholdHours` fields on each
  `domainTimers` entry — consumed by plans `2026-08-24-05`, `2026-08-24-06`, and
  `2026-08-24-07`.
- `grantResetTokenIfEarned`, `secondsUntilTokenReady`, and
  `normalizeTokenThresholdHours` in `src/timer-utils.js` — consumed by plans
  `2026-08-24-05`, `2026-08-24-06`, and `2026-08-24-07`.

## Pattern exemplar

- **MUST follow the pattern in**: `src/timer-utils.js` — `applyRecharge` and
  `normalizeRechargeRate` are the direct models. The threshold normalizer mirrors
  the rate normalizer, and the grant helper mirrors the recharge helper: injected
  timestamp, defensive normalization of every field, a returned copy, and no
  mutation.
- **Follow the pattern in**: `tests/timer-logic.test.js` — the recharge tests set
  the style for threshold boundaries and clock-jump guards.

## Tasks

- [ ] Add `normalizeTokenThresholdHours` with the four-value ladder and the
      default of 8.
- [ ] Add `grantResetTokenIfEarned`, granting only when no token is held and the
      elapsed absence reaches the threshold.
- [ ] Add `secondsUntilTokenReady` for the Options column that a later plan adds.
- [ ] Export all three helpers three ways.
- [ ] Call the grant helper for every away domain inside
      `applyRechargeToAllTimers`, after crediting recharge and before updating the
      blocked state.
- [ ] Refresh `awaySince` for the active domain in the countdown tick.
- [ ] Extend the seeded defaults with the three new fields.
- [ ] Write the unit and integration coverage listed in the acceptance criteria.
- [ ] Update `docs/SPEC.md` and the storage bullets in `AGENTS.md`.
- [ ] Run `pnpm test`, `pnpm lint`, and `pnpm format`.

## Implementation notes

`awaySince` must be a new field. `lastVisitTimestamp` cannot serve as the away
clock: `applyRecharge` advances it only by the wall-clock time its credited whole
seconds consumed, and its already-full branch stamps it to the current time on
every pass. Neither behavior measures absence, and reusing the field would make
tokens unreachable for any domain sitting at its cap.

Keep both fields updated in the countdown tick. `lastVisitTimestamp` continues to
serve recharge accounting; `awaySince` records presence and nothing else.

Grant order inside the pass matters for readability rather than correctness:
credit recharge, then grant tokens, then update blocked state, then write
`domainTimers` once. Do not add a second storage write.

A token is granted regardless of the current budget, including a budget already at
its cap. The value of a token is realized when it is spent, not when it is earned,
and the spend path in the next plan refuses a spend that would gain nothing.
