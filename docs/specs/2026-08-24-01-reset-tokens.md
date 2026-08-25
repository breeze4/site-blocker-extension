# Reset tokens, and removal of pause

Status: specified, not implemented.

Source: `inputs/inbox/Site timer blocker feedback.md` — "Remove the pause feature,
totally useless. Maybe turn it into a 'give me more time' with max charges that
recharge without usage."

## Problem statement

Two problems, one cause.

The pause feature does not work as self-control. Pause is global, password-gated,
and open-ended: one correct code turns off every timer on every site until you
turn it back on. The friction that guards it — a manual trip to the Options page
to read a rotating password — costs effort every time without changing the
outcome. The escape hatch is too big, so it either goes unused or it defeats the
whole extension.

At the same time there is no small escape hatch. When a budget runs out you are
done for hours, whatever the reason. The only ways back in are the global pause,
the unlimited "Reset All Timers" button in Options, or waiting on a recharge that
returns one second of budget every two minutes at the default rate. That last
path also makes the block porous: two minutes after a block you can load the site
again, get about a second, and get bounced, indefinitely.

## Solution

Replace pause with a per-domain reset token: a single, earned, one-shot top-up.

You earn a token for a domain by staying off it for an unbroken stretch — eight
hours by default. Holding a token lets you refill that domain's budget to full,
once. Spending it clears it, and the next one costs another full stretch of
absence. Tokens do not stack, do not bank, and do not transfer between domains.

Reset tokens and the existing time recharge are the same idea at two scales:
absence earns access. Recharge is the slow drip that refills the budget over
hours; a token is the lump sum for a long absence. Both surface together in
Options under one heading.

The block also becomes a real wall. Once a domain hits zero it stays blocked
until the budget recharges to 10% of its cap, so waiting five minutes buys
nothing. The way back in is a genuine wait or a token.

## User stories

1. As someone who lost an evening to a paused blocker, I want the global pause
   removed, so that no single action can disable enforcement everywhere.
2. As someone who came back after a workday away, I want that absence to earn me
   something, so that discipline has a visible payoff.
3. As someone out of time on one site, I want a way to buy a little more, so that
   a hard stop mid-task is recoverable.
4. As someone who wants that hatch to stay small, I want exactly one token per
   domain, so that I cannot save up a night's worth of bypasses.
5. As someone who avoided a site for a week, I want no extra credit beyond one
   token, so that long absences cannot be cashed in as a binge.
6. As someone who checks a site for ten seconds at hour seven, I want that peek to
   cost me the token, so that the incentive is to stay away, not to hover.
7. As someone who earned a token and then visited normally, I want to keep the
   token, so that arriving on the site does not destroy the thing I came to spend.
8. As someone whose budget is full, I want the token held for later, so that
   earning one early does not waste it.
9. As someone whose budget is full, I want the spend refused, so that I cannot
   trade a token for nothing.
10. As someone approaching the end of a session, I want the reset offered on the
    page itself, so that I do not have to hunt for it as time runs out.
11. As someone who does not want to be nagged, I want the on-page reset hidden
    until time is nearly gone, so that the escape hatch is not advertised all
    session.
12. As someone who clicks the reset, I want it to apply immediately with no
    confirmation, so that the action matches the deliberate intent behind it.
13. As someone whose time has run out, I want a real block page instead of a
    silent bounce to the new tab page, so that I know which site stopped and why.
14. As someone on that block page, I want to know when the site becomes usable
    again, so that I can decide whether to wait.
15. As someone on that block page holding a token, I want to spend it there, so
    that the offer appears exactly where I hit the wall.
16. As someone who spends a token from the block page, I want to land back on the
    exact page I was reading, so that I do not pay a second time by losing my
    place.
17. As someone on a page where the overlay cannot draw, such as the Chrome Web
    Store or the PDF viewer, I want the toolbar popup to offer the reset, so that
    the token is never unreachable.
18. As someone opening the popup, I want to see whether I hold a token, so that I
    know my position without opening Options.
19. As someone who blocked a new site from the popup, I want it to inherit the
    current token threshold, so that settings stay consistent across domains.
20. As someone reviewing settings, I want recharge and tokens presented as one
    group, so that the two rewards read as one system.
21. As someone tuning the system, I want to choose the absence threshold, so that
    I can set how hard a token is to earn.
22. As someone reviewing a domain, I want a column showing whether its token is
    ready or how long the wait is, so that I can answer "why is there no button?".
23. As someone worried about my own discipline, I want spends recorded per day and
    all time, so that I can see whether I am buying my way back in more often.
24. As someone who resets a domain's tracking, I want the spend counts cleared with
    the rest, so that the analytics reset is complete.
25. As someone who waits out a block, I want the site to stay blocked until a
    useful amount of budget returns, so that a two-minute wait does not buy a
    one-second visit.
26. As someone mid-session whose time drops low, I want to keep browsing to zero,
    so that the re-entry floor never cuts a session short.
27. As someone who wants settings reachable, I want the Options link back in the
    popup, so that I am not forced through the browser's extension pages.
28. As someone who wants no unearned top-ups, I want "Reset All Timers" removed,
    so that the token is the only way to refill a budget.
29. As someone upgrading from an older version, I want existing timers to keep
    working, so that no data is lost and nothing needs reconfiguring.
30. As someone who used pause before, I want its stored state cleaned up, so that
    dead keys do not linger in local storage.
31. As a developer, I want the spend to go through the background worker, so that
    the single-writer rule for `timeLeft` holds.
32. As a developer, I want the block page to stay out of `web_accessible_resources`,
    so that websites cannot detect the extension by probing for it.
33. As a developer, I want the token rules in pure helpers, so that every rule is
    unit-testable without a browser.

## Data flow

Granting a token, on every tab pass in the background worker:

1. The worker handles a tab on activation, navigation, or focus change.
2. It credits recharge for every away domain through `applyRecharge`, unchanged.
3. It then calls `grantResetTokenIfEarned` for every away domain. That helper
   grants a token when the domain holds none and `now - awaySince` is at least
   `tokenThresholdHours`.
4. It calls `updateBlockedState` for every domain, which clears `isBlocked` once
   `timeLeft` reaches the re-entry floor.
5. It writes `domainTimers` once, then decides whether the active tab is allowed.

Blocking a tab:

1. The worker checks `canAccessDomain`, which requires `isBlocked` to be false and
   `timeLeft` above zero.
2. On a denial it navigates the tab to the block page, passing the domain and the
   blocked URL as query parameters.
3. When the per-second countdown reaches zero, the worker sets `isBlocked`, stops
   the countdown, ends the tracking session, and navigates the same way.
4. The content script independently checks the same state on load. If the domain
   is blocked, it asks the worker to navigate the tab, so both paths land on the
   same page. If that message fails, it falls back to replacing the page body with
   a plain block message.

Spending a token, from the block page, the overlay, or the popup:

1. The surface sends a `spendResetToken` message naming the domain.
2. The worker loads `domainTimers` and calls the pure `spendResetToken` helper.
3. The helper refuses when no token is held or when `timeLeft` is already at the
   cap. Otherwise it sets `timeLeft` to `originalTime`, clears `resetToken`,
   clears `isBlocked`, and stamps `awaySince` to now.
4. On a successful spend the worker increments today's entry in
   `resetTokenSpends` and increments `allTimeResetSpends` for that domain, writes
   both records, restarts the countdown for the active tab, and answers with the
   result.
5. The block page navigates back to the URL it was given. The overlay and the
   popup re-render from storage; the worker's write reaches the overlay through
   the existing `chrome.storage.onChanged` listener.

Reading token state, in the overlay, popup, and Options page:

1. Each surface reads `domainTimers` and passes the entry to a pure helper.
2. The overlay uses `shouldOfferOverlayReset`. The popup uses `resetToken` alone.
3. The Options page uses `secondsUntilTokenReady` for its column, recomputed on
   the existing once-per-second refresh.

## Behavior

### Earning a token

- A domain holds at most one token. `resetToken` is a boolean.
- A token is granted when the domain has been away for at least
  `tokenThresholdHours` without interruption. Away means the domain was not the
  active, focused tab.
- `awaySince` records the last moment the domain was the active, focused tab. The
  countdown refreshes it every second while the domain is active, so the absence
  starts the instant you leave.
- Any visit restarts the clock. A visit at hour seven of an eight-hour threshold
  means the next token is eight hours from that visit.
- A visit does not take a token you already hold. Without this rule a token could
  never be spent, because spending requires being on the site.
- A token is granted whether or not the budget is full. You hold it until you
  spend it.
- Grants are computed lazily on the tab pass, from stored timestamps. Nothing
  polls, and no surface counts down to the next token during normal browsing.
- Token accrual runs in parallel with time recharge, not after the budget refills.
  Gating on a full budget would make tokens unreachable: at the default 30 seconds
  per hour against a five-minute cap, an empty budget needs 10 hours of absence to
  reach the cap.
- The threshold takes one of four values: 4, 8, 12, or 24 hours. The default is 8.
  It is stored per domain and rewritten across all domains by one global control,
  matching how `rechargeRate` already works.

### Spending a token

- A spend sets `timeLeft` to `originalTime`, clears `resetToken`, clears
  `isBlocked`, and restarts the away clock.
- The background worker is the only writer. Every surface requests a spend by
  message and re-reads storage afterward.
- A spend is refused when the domain holds no token, and when `timeLeft` is
  already at or above `originalTime`. A top-up on a full budget gains nothing.
- Below the cap a spend is allowed with no confirmation, including when most of
  the budget remains. This is an accepted trade: the visibility rules keep the
  offer out of sight during the part of a session where a spend would be wasteful,
  and confirmation dialogs were rejected as ceremony.
- Spending never raises `timeLeft` above `originalTime`, so every existing
  progress bar and estimate keeps its invariant.

### Blocking and re-entry

- `isBlocked` is stored state, set when the countdown reaches zero.
- It is cleared when recharge brings `timeLeft` to at least 10% of `originalTime`,
  and when a token is spent.
- A stored flag is required rather than a live comparison. Blocking whenever
  `timeLeft` is under the floor would end a session the moment the last seconds
  ticked below it.
- At the seeded 60-second cap the floor is 6 seconds, reached about 12 minutes
  after a block at the default rate. At a five-minute cap it is 30 seconds,
  reached about an hour after a block.
- A blocked tab is navigated to the block page, which replaces the previous bounce
  to the browser's new tab page. Both the expiry path and the re-navigation path
  use it.
- The block page names the domain, states that time is up, and gives the time
  until the domain is usable again, meaning the time until `timeLeft` reaches the
  re-entry floor. When a token is held it also offers the reset.
- The block page is reached only by extension-initiated navigation, so it stays
  out of `web_accessible_resources` and websites cannot probe for it.

### Surfaces

- The overlay pill gains a "Reset timer" text button. It appears only when the
  domain holds a token and `timeLeft` is at or below the larger of 30 seconds and
  25% of the cap. One click spends the token.
- The overlay host keeps `pointer-events: none`; only the button element takes
  pointer events, so the pill still never intercepts page clicks.
- The popup shows the reset button whenever a token is held, disabled when the
  budget is at the cap. The popup is the fallback for pages where the content
  script cannot render an overlay.
- The popup loses the pause panel and regains a link to the Options page.
- The popup's "Block this site" inherits `tokenThresholdHours` from existing
  domains, falling back to 8, exactly as it already inherits `rechargeRate`.
- The Options page presents recharge rate and token threshold as one group under a
  shared heading, styled as one system, since both reward the same behavior.
- The Options domain table gains a tenth column, "Reset token". Its first line
  reads "Ready" or the remaining wait, such as "in 5h". A muted second line reads
  the 30-day spend count, such as "3 used (30d)".
- The Options page loses the pause password panel and the "Reset All Timers"
  button. Changing a domain's time limit still refills its budget through
  `applyTimerSettingsChange`, so no unconditional refill remains.

### Pause removal

- The `blockingPaused` and `pausePassword` storage keys, the worker's pause gate,
  the popup pause panel, the Options password panel, the content script's paused
  checks, and the three password helpers are all removed.
- Both dead keys are deleted from local storage on startup, which needs a small
  remove helper added to the storage utilities.

### Analytics

- Per-domain tracking gains `resetTokenSpends`, an ISO-date-to-count map, and
  `allTimeResetSpends`, a running count.
- `resetTokenSpends` is pruned at 30 days alongside the existing daily totals.
  `allTimeResetSpends` is never pruned.
- Reset Tracking, per domain and for all domains, clears both alongside the
  existing totals.

### Existing data

- Every new field is read forgivingly, with no migration step and no data wipe.
- `resetToken` missing reads as false.
- `awaySince` missing falls back to `lastVisitTimestamp`, then to the current time.
- `tokenThresholdHours` missing reads as 8.
- `isBlocked` missing derives from whether `timeLeft` is at or below zero.
- `resetTokenSpends` and `allTimeResetSpends` missing read as an empty map and
  zero.
- A separate `awaySince` field is required. `lastVisitTimestamp` cannot serve as
  the away clock: the recharge helper advances it only by the time its credited
  seconds consumed, and stamps it to the current time on every pass once the
  budget sits at its cap. Neither behavior measures absence.

### Documentation changes required

- The main project spec records a non-goal that the overlay is display-only with
  no controls. That non-goal is retired by the reset button.
- The same spec records the missing Options link in the popup as intentional
  friction guarding the pause password. That entry is retired with pause.
- The removed-features list gains pause, the pause password, and "Reset All
  Timers", each with its reason.

## Modules

- Pure timer helpers: the token and blocked-state rules as functions over a timer
  record and a timestamp.
  - Role: **defines** the shared interface — field semantics and every rule.
  - Interface: gains `grantResetTokenIfEarned`, `spendResetToken`, `reEntryFloor`,
    `updateBlockedState`, `canAccessDomain`, `secondsUntilTokenReady`,
    `shouldOfferOverlayReset`, and `normalizeTokenThresholdHours`. Loses
    `generatePausePassword`, `normalizePausePassword`, and `checkPausePassword`.
  - Test: yes.
- Background worker: the sole writer of timer state, and the only actor that
  navigates tabs.
  - Role: **defines** the message protocol; **consumes** the pure helpers.
  - Interface: adds the `spendResetToken` and `blockTab` message actions to the
    existing action dispatcher; extends the recharge pass with token grants and
    blocked-state maintenance; removes the pause gate and password setup; deletes
    dead storage keys on startup.
  - Test: yes.
- Block page: a dedicated extension page shown in place of the bounce to the new
  tab page.
  - Role: **consumes** the message protocol and the timer record.
  - Interface: reads the domain and the blocked URL from query parameters; renders
    status, the time until re-entry, and the reset button; navigates back to the
    blocked URL after a spend.
  - Test: yes, for its pure parts — parameter parsing, the return-URL decision,
    and which elements render for a given timer record.
- Content overlay: the on-page pill.
  - Role: **consumes**.
  - Interface: adds the reset button under `shouldOfferOverlayReset`; asks the
    worker to navigate a blocked tab, with a body-swap fallback; drops the paused
    checks.
  - Test: yes, extending the existing content script suite.
- Toolbar popup: the compact entry point.
  - Role: **consumes**.
  - Interface: drops the pause panel; adds the Options link, the reset button, and
    threshold inheritance when blocking a new site.
  - Test: yes, for its pure helpers.
- Options page: settings and analytics.
  - Role: **consumes**.
  - Interface: drops the password panel and "Reset All Timers"; adds the threshold
    radios in a shared group with recharge; adds the tenth column.
  - Test: yes, extending the existing options suite.
- Storage utilities: the promisified local-storage wrapper.
  - Role: **defines** the storage access interface.
  - Interface: gains a remove helper for deleting the dead pause keys.
  - Test: yes, covered through the suites that use it.
- Packaging script: the Chrome Web Store bundler.
  - Role: **consumes**.
  - Interface: its explicit file list gains the two block page files.
  - Test: no. Its existing missing-file guard fails the build if the list drifts.

## Resolved decisions

- Token scope: per domain — staying off one site must not buy time on another,
  and the per-domain away clock already exists. The alternative, a global pool,
  lets you farm charges on sites you never visit.
- Token grant: top up `timeLeft` to `originalTime` — the cap already defines one
  sitting, so no new setting is needed and `timeLeft` never exceeds
  `originalTime`. Flat bonus minutes would break that invariant and the estimates
  built on it.
- Maximum tokens: one per domain — no banking, no sequential spends. Chosen over
  three after considering that a bank of tokens is a night's worth of bypasses.
- Accrual model: a threshold on unbroken absence, not fractional accrual — with a
  maximum of one token, a drip rate has nothing to fill. The threshold also
  creates the intended incentive to stay away as long as possible.
- Threshold values: 4, 8, 12, or 24 hours, default 8, set globally and stored per
  domain — mirrors the existing recharge-rate control exactly.
- Accrual timing: parallel with recharge, not gated on a full budget — gating
  would make tokens practically unreachable at the default rate. The arithmetic is
  in the Behavior section.
- Evaluation: lazy, on the tab pass — the user does not want to watch tokens
  accrue during normal browsing, and the recharge pass already runs there.
- Away clock: a new `awaySince` field — `lastVisitTimestamp` is a recharge ratchet
  and is overwritten at the cap, so it cannot measure absence.
- Token retention across visits: a visit restarts the clock but never takes a held
  token — the alternative makes the token unspendable, since spending requires
  being on the site.
- Spend surfaces: the block page and the overlay, plus the popup — the popup alone
  is not enough, because after a block the popup sees an untrackable page and has
  no idea which domain was blocked.
- Block target: a dedicated extension block page, replacing the bounce to the new
  tab page — it is the only target that carries domain context and can host the
  button.
- Block surface count: one — the content script asks the worker to navigate rather
  than rendering its own block screen, with the body swap kept only as a fallback
  when the message fails. Two divergent block screens were rejected.
- Post-spend navigation: return to the exact blocked URL — the token already cost
  a long absence, so making you re-find your place charges twice. The URL appears
  in local history only.
- Overlay visibility: token held and `timeLeft` at or below the larger of 30
  seconds and 25% of the cap — keeps the escape hatch out of sight for most of a
  session, and removes the wasteful-spend case without a dialog.
- Overlay confirmation: none — by the time the button appears, spending is
  obviously the intent.
- Popup visibility: whenever a token is held, unlike the overlay — the popup is a
  deliberate click rather than an ambient nag. This reopens the wasteful-spend
  case, accepted knowingly.
- Wasteful spends: guarded only by refusing a spend at the cap — a spend that
  gains nothing is refused; a spend that gains little is allowed.
- Write path: spends go through the worker by message — preserves the
  single-writer rule for `timeLeft` on which every surface depends.
- Re-entry floor: 10% of the cap, chosen over 25% or a 30-second floor — without
  it, a blocked domain becomes reachable for about a second every two minutes,
  which is both jank and a reason to never earn a token.
- Blocked state: a stored flag, not a live comparison — a comparison would cut a
  session short the moment the remaining time fell below the floor.
- Pause: removed entirely, including the password helpers, both storage keys, and
  its test suite — the reset token replaces it as the only escape hatch.
- Options link in the popup: restored — the friction it created guarded the pause
  password, which no longer exists.
- "Reset All Timers": removed — an unlimited unearned refill sitting two clicks
  from any page would make the token economy pointless. Regating it behind the old
  pause password was rejected as the same rejected machinery in a new hat.
- Options presentation: recharge and tokens grouped under one heading and styled
  as one system — both reward the same behavior at different scales.
- Options table: a tenth column showing token state and the 30-day spend count —
  Options is a deliberate visit, so it can answer "why is there no button?"
  without nagging during browsing.
- Spend tracking: recorded per day and all time — the user wants to see whether
  they are compromising their own discipline over time.
- Manifest: one change, and no new permission — the content script list gains the
  pure timer helpers ahead of the content script, so the overlay reuses the tested
  visibility rule instead of carrying a duplicate copy.
- Block page exposure: none — every navigation to the block page is
  extension-initiated, so the page needs no `web_accessible_resources` entry,
  which also prevents websites from fingerprinting the extension.

## Judgment calls

None. Every decision surfaced during the interview was resolved, and each one is
recorded in the previous section with its reasoning.

## Testing decisions

Modules to test: the pure timer helpers, the background worker, the block page's
pure parts, the content overlay, the popup's pure helpers, and the Options page.
Only the packaging script is untested, and its existing missing-file guard fails
the build if its file list drifts.

Prior art in the repo:

- The pure-helper suite drives functions directly with an injected timestamp,
  which is the pattern the existing recharge tests use for cap clamping, remainder
  carry, and backwards-clock guards. Every new token rule follows it.
- The background suites require the helper module, install it as a worker global,
  stub the tab APIs, and assert on the resulting timer records. Extend them for
  token grants across the threshold, the spend path including both refusals, the
  blocked-state lifecycle from expiry through re-entry, and spend counting.
- The options and content suites mock the storage utilities and exercise the real
  logic under jsdom. Extend them for the tenth column, the threshold control
  rewriting every domain, and overlay button visibility.
- Delete the pause suite outright.

New coverage to write, at minimum: a token is granted exactly at the threshold and
not before; a visit inside the threshold restarts the clock; a visit does not take
a held token; a token is granted with a full budget; a spend refills to the cap and
clears both the token and the blocked state; a spend is refused with no token and
refused at the cap; the re-entry floor blocks at 9% and admits at 10%; a low
`timeLeft` mid-session does not trigger a block; every new field reads forgivingly
when absent; and spend counts increment daily and all time and clear on a tracking
reset.

Frontend verification: the block page, the overlay button, the popup button, and
the Options column are covered by jsdom tests for logic and rendering decisions,
not by pixel verification. Three surfaces change visually — the block page is new,
the overlay gains an interactive element, and Options loses two panels and gains a
column — so a manual load-unpacked pass is expected before release. It must cover
a real block landing on the block page, a spend returning to the original URL, the
overlay button appearing only near the end of a session, and the overlay pill
still not intercepting page clicks.

## Out of scope

- Any replacement for the global pause. There is no off-switch after this work.
- More than one token per domain, token banking, and tokens shared across domains.
- Fractional or drip token accrual, and any live countdown to the next token
  outside the Options table.
- Configurable overlay visibility. The 30-second and 25% rule is fixed in code.
- A confirmation dialog on any spend path.
- Configurable re-entry floor. The 10% rule is fixed in code.
- Analytics beyond spend counts. No streak lengths, no earned-token counts, and no
  charts for either.
- Changes to time recharge itself, to the rate ladder, to the tracking model, or
  to the rolling analytics windows.
- Manifest permission changes, `web_accessible_resources`, cloud sync, and
  subdomain grouping. The only manifest edit is adding the pure timer helpers to
  the content script list.
- Restyling the Options page beyond grouping recharge with the token threshold and
  adding the new column.
