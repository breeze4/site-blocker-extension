# Overlay and popup spend surfaces

## Parent spec

`docs/specs/2026-08-24-01-reset-tokens.md` — see "Surfaces" and the resolved
decisions for overlay visibility, popup visibility, and confirmation.

## What to build

Two more places to spend a token, each with its own visibility rule.

The overlay pill gains a "Reset timer" button that appears only when a token is
held and the remaining time is nearly gone. That rule is the design's waste guard:
the offer is absent for most of a session, so it cannot be clicked away early.

The popup shows the button whenever a token is held, because a deliberate click on
the toolbar icon is not an ambient nag, and because the popup is the only surface
that works on pages where a content script cannot render. The popup also starts
seeding the token fields when it blocks a new site.

## Goal

The reset is reachable from the page itself as time runs low, and from the toolbar
popup whenever a token is held, including on pages where the overlay cannot draw.

## Type

AFK

## Blocked by

- Blocked by `2026-08-24-05-spending-tokens.md`

## User stories addressed

- User story 10
- User story 11
- User story 12
- User story 17
- User story 18
- User story 19

## Acceptance criteria

- [ ] `shouldOfferOverlayReset` returns true only when a token is held and
      `timeLeft` is at or below the larger of 30 seconds and 25% of the cap. Unit
      tests cover a 60-second cap where the bound is 30, a 300-second cap where
      the bound is 75, the exact boundary value, one second above it, and a held
      token with a full budget.
- [ ] `shouldOfferOverlayReset` returns false whenever no token is held,
      regardless of remaining time.
- [ ] A content script test asserts the overlay renders the button when the helper
      returns true and omits it when the helper returns false, driven through the
      storage change listener rather than by calling the renderer directly.
- [ ] A content script test asserts the overlay host still carries
      `pointer-events: none` and that the button element carries
      `pointer-events: auto`.
- [ ] A content script test asserts a click sends the spend message with the
      current domain and does not write `domainTimers` from the content script.
- [ ] A popup test asserts the reset control is hidden with no token, shown with a
      token below the cap, and disabled with a token at the cap.
- [ ] A popup test asserts blocking a new site writes `tokenThresholdHours`
      inherited from an existing domain, falling back to 8 with no domains, plus
      `resetToken: false`, `isBlocked: false`, and an `awaySince` timestamp.
- [ ] `pnpm test` passes and `pnpm lint` reports no new errors.

## Owns

- `src/timer-utils.js` — new `shouldOfferOverlayReset` and its three export
  entries.
- `src/content.js` — the overlay markup inside `buildOverlay`, `renderOverlay`,
  `syncOverlay`, and a click handler that sends the spend message.
- `src/popup.html` — the reset control markup and styles.
- `src/popup.js` — `renderSiteStatus` or a sibling renderer for the control, the
  click handler, `getInheritedRechargeRate`'s new sibling for the threshold, and
  `handleBlockSite`.
- `tests/timer-logic.test.js` — visibility helper coverage.
- `tests/content-script.test.js` — overlay button coverage.
- `tests/popup-helpers.test.js` — popup control and inheritance coverage.
- `docs/SPEC.md` — the overlay section, the popup section, and the "Reset tokens"
  section.

## Must not touch

- `src/blocked.*` — owned by `2026-08-24-05-spending-tokens.md`.
- `src/background.js` — the spend action already exists; if it appears to need a
  change, stop and re-read the response shape defined by plan `2026-08-24-05`.
- `src/options.*` — owned by `2026-08-24-07-options-token-ui.md`.

## Defines interfaces

- `shouldOfferOverlayReset` in `src/timer-utils.js` — consumed by
  `src/content.js` in this plan.

Note that `src/content.js` loads only the storage utilities. Adding the
timer utilities to the content script entry in the manifest is the one manifest
change this work needs; the alternative is a local copy of the rule, which
duplicates a tested helper and is not acceptable.

## Pattern exemplar

- **MUST follow the pattern in**: `src/content.js` — `buildOverlay` and
  `renderOverlay` are the models. The button lives inside the same shadow root,
  styled by the same inline style block, and the pill continues to be created once
  and updated in place rather than rebuilt.
- **Follow the pattern in**: `src/popup.js` — `getInheritedRechargeRate` is the
  exact model for threshold inheritance, including the fallback constant and the
  skip of invalid stored values.

## Tasks

- [ ] Add `shouldOfferOverlayReset` as a pure helper and export it three ways.
- [ ] Add the timer utilities to the content script's script list in the manifest,
      before `content.js`.
- [ ] Add the button to the overlay's shadow root, with `pointer-events: auto` on
      the button only, and keep the host non-interactive.
- [ ] Show and hide the button from `syncOverlay` through the helper, and send the
      spend message on click.
- [ ] Add the popup control, shown whenever a token is held and disabled at the
      cap, wired to the same message.
- [ ] Add threshold inheritance and the three new fields to the popup's
      block-this-site path.
- [ ] Write the coverage listed in the acceptance criteria.
- [ ] Update `docs/SPEC.md`, including retiring the non-goal that the overlay
      carries no controls.
- [ ] Run `pnpm test`, `pnpm lint`, and `pnpm format`.

## Implementation notes

The manifest's content script entry lists the storage utilities and the
content script. Add the timer utilities between them, matching the load order the
popup and Options pages already use. This is the only manifest change in the whole
feature, and it adds no permission.

Keeping the host at `pointer-events: none` matters. The pill sits at the maximum
z-index across the entire viewport corner; making the host interactive would let
it swallow clicks meant for the page. Only the button element takes pointer
events.

The overlay updates through the storage change listener, so after a spend the
worker's write re-renders the pill with the refilled budget and, because the token
is now gone, without the button. No extra refresh is needed on the content script
side.

`docs/SPEC.md` records a non-goal that the overlay is display-only with no
controls. Retire that entry with its reason rather than deleting it silently.
