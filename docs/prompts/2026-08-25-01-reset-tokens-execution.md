# Reset token orchestration plan

Paste the `Launch Prompt` block below into a fresh Codex CLI session as-is. The
session must read this entire file from disk before running the `Orchestration
Plan` section.

## Launch prompt

```
/goal The reset-token economy is fully implemented and verified: every unchecked task in docs/plans/2026-08-24-01-remove-pause.md through docs/plans/2026-08-24-07-options-token-ui.md is checked off, each step's acceptance criteria were verified by a fresh-context reviewer with per-criterion evidence, `pnpm test`, `pnpm lint`, and `pnpm format:check` pass on the final tree, one commit exists per completed step plus one docs-only report commit, and docs/handoff/2026-08-25-01-reset-tokens-run.html exists as the finalized report. Read the full orchestration plan at docs/prompts/2026-08-25-01-reset-tokens-execution.md before starting, follow it exactly, maintain and render docs/handoff/progress.json per its instructions, and stop immediately on any failed gate without attempting repair. If any required gate fails: record the failing command and complete output, make no further implementation changes, do not commit the broken step, finalize and rename the progress pair to docs/handoff/2026-08-25-01-reset-tokens-run.{json,html}, commit only that pair as "run: reset-tokens — report (fail)", and end. On success, finalize the report the same way with "report (pass)". Your final message must include the gate commands with exit status, `git log --oneline` for all run commits, and the absolute path to the finalized report file.
```

## Orchestration plan

### Run shape

- **Runtime mapping**: every step is `local`—this session executes each step directly. No subagents are used.
- **Sequencing**: strict serial, steps 1–7 in numeric order. Parallel execution of steps 3 and 4 was rejected because both modify `src/background.js` and shared storage helpers.
- **Human-in-the-loop checkpoints**: none. No step pauses for human input.
- **Commands**: `$TEST_CMD` = `pnpm test`; `$LINT_CMD` = `pnpm lint`; `$FORMAT_CMD` = `pnpm format:check`. There is no build or typecheck; the files under `src/` ship as-is.

### Progress report

Before Step 1:

1. Create `docs/handoff/progress.json` following `/Users/breeze/.claude/skills/plans-to-prompt/progress/SCHEMA.md`, with all seven steps `queued`, `started` and `updated` stamped from the Mac's local time, `now` set, and a newest-first `events` entry noting run start.
2. Render with `sh /Users/breeze/.claude/skills/plans-to-prompt/progress/build.sh docs/handoff/progress.json docs/handoff/progress.html`.
3. Report the absolute local path of `docs/handoff/progress.html` to the operator.

After every state change (step launch, gate verdict, step commit, failure, terminal state): update `progress.json`, stamp `updated`, prepend an event, re-render. Never hand-edit `progress.html`; if rendering fails, fix the JSON. Workers never touch progress files. Never stage `docs/handoff/progress.json` or `progress.html` in a step commit.

Every recorded verdict carries evidence: test/lint/format gates store exact command and roughly the last 20 output lines (`full` verbatim when failed); acceptance gates store one entry per plan criterion with `text`, `status`, one-line `evidence`.

### Steps

Each step follows the same contract. Substitute the step's plan file for `<plan>` and N for the step number.

- **Read first**: the plan file itself—its `Goal`, `Workflow`, `What to build`, and `Acceptance criteria` sections are authoritative. Parent spec: `docs/specs/2026-08-24-01-reset-tokens.md`. Architecture context: repo root `AGENTS.md` and `docs/SPEC.md`.
- **Mode**: local.
- **Owns**: the files the plan names, plus additional test files under `tests/`. Do not touch plans other than your own.
- **Gate** (after implementing): run `$TEST_CMD`, then `$LINT_CMD`, then `$FORMAT_CMD`. All three must exit 0. On any failure: record complete output in `progress.json`, set run and step to `fail`, render, and enter the failed-gate terminal state described below.
- **Acceptance verification**: after the gate passes, launch a fresh-context verifier that receives only the plan's `Acceptance criteria` and `Done when` text, the current diff (`git diff`), and the test commands. It gets no implementer summary. It must try to refute the implementation, exercise behavior where possible, and return exactly one `{text, status: pass|fail, evidence}` result per criterion — a bare aggregate verdict is invalid. Record results in `progress.json`. Any fail enters the failed-gate terminal state.
- **Check off**: mark completed `- [ ]` tasks and now-satisfied acceptance criteria as `- [x]` in the plan file.
- **Commit**: after verification passes, stage only the step's owned source and test files, the handoff file `docs/handoff/step-N-<plan-slug>.md`, and that step's plan file. Message: `step-N: <plan-slug> - <one-line summary>`. Never use `git add -A`. Don't add AI attribution or co-author trailers.
- **Handoff**: write `docs/handoff/step-N-<plan-slug>.md` summarizing what changed and what later steps need to know; the controller reads prior handoffs before launching the next step.
- Stay within the plan's scope. If you see an improvement belonging to a later step, leave it.

The seven steps, in order:

1. **Remove pause**—`docs/plans/2026-08-24-01-remove-pause.md`
2. **Blocked state and re-entry floor**—`docs/plans/2026-08-24-02-blocked-state.md`
3. **Block page**—`docs/plans/2026-08-24-03-block-page.md`
4. **Earning tokens**—`docs/plans/2026-08-24-04-earning-tokens.md` (pure logic + tests; no UI)
5. **Spending a token from the block page**—`docs/plans/2026-08-24-05-spending-tokens.md`
6. **Overlay and popup spend surfaces**—`docs/plans/2026-08-24-06-spend-surfaces.md`
7. **Options token controls and column**—`docs/plans/2026-08-24-07-options-token-ui.md`

Steps 3 and 4 define no interface consumed by the other beyond what their plans specify and existing storage tests cover, so the standard post-step gate suffices; no extra interface gates are added.

Live browser and UI gates are intentionally omitted: this is a Chrome MV3 extension with no dev server, and this environment can't automate an unpacked extension. UI-facing steps (3, 5, 6, 7) compensate with integration tests against jsdom surfaces per their plans. You confirm the visual result during the end-of-run review by loading `src/` unpacked.

### Failed-gate terminal state

On any failed gate or verifier criterion: record the failing command and complete output verbatim in `progress.json`, set run and step status to `fail`, prepend the failure event, render the terminal page, and stop implementation immediately. Do not attempt repair. Then rename the progress pair to `docs/handoff/2026-08-25-01-reset-tokens-run.{json,html}` (rename, not copy) and commit only that pair as `run: reset-tokens — report (fail)`. End the run reporting the failing evidence.

### Success terminal state

After step 7 commits: verify the final tree once more with `$TEST_CMD`, `$LINT_CMD`, `$FORMAT_CMD`; confirm every task box in the seven plan files is `- [x]` and `git log --oneline` shows one commit per step; mark all steps done in `progress.json`, prepend the completion event, render, rename the pair to `docs/handoff/2026-08-25-01-reset-tokens-run.{json,html}`, and commit only that pair as `run: reset-tokens — report (pass)`. Final message: gate commands with exit status, `git log --oneline`, absolute path to the finalized report.
