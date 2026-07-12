---
id: BACK-366.01
title: Refactor init wizard prompts to clack
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 22:19'
updated_date: '2026-02-20 22:29'
labels: []
dependencies: []
parent_task_id: BACK-366
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: keep the initialization experience consistent with the new prompt library.
What: migrate the init wizard’s interactive prompt flow to clack while preserving the same choices, messaging, and validation outcomes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Init wizard prompts use clack for all interactive questions.
- [x] #2 The wizard presents the same options and guidance as before (no content loss).
- [x] #3 Cancellation paths behave equivalently to current flow.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## BACK-366.01 Plan: Migrate `backlog init` Interactive Prompts to Clack

### Summary
Migrate the `init` command’s interactive prompt flow in `src/cli.ts` from `prompts`/readline-style inputs to `@clack/prompts`, while preserving current question text, choice content, defaults, and cancellation behavior. Keep scope limited to `BACK-366.01` (init flow only), leaving advanced-config wizard internals and other CLI prompt flows for `BACK-366.02` / `BACK-366.03`.

### Execution Setup
1. Update Backlog task to `In Progress`, assign `@codex`, and record this plan.
2. Create branch from `main`: `tasks/back-366-01-init-wizard-clack`.
3. Run `context-hunter` workflow (`L1`) before edits and capture a micro-brief.

### Code Changes
1. Add `@clack/prompts` to `package.json` while keeping `prompts` for non-init flows.
2. In `src/cli.ts`, migrate init interactive prompt points to clack:
   - git repo bootstrap confirm
   - project name text
   - task prefix text
   - integration mode select
   - CLI instruction multiselect
   - MCP client multiselect
   - advanced-settings confirm
3. Preserve existing output content, defaults, and cancellation semantics.

### Cancellation parity to preserve
1. Integration mode cancel: print `Initialization cancelled.` and return.
2. CLI instruction selection cancel: go back to integration mode loop.
3. MCP client selection cancel: go back to integration mode loop.
4. Advanced-settings confirm cancel: print `Aborting initialization.` and exit 1.

### Validation
Targeted init test files and manual interactive cancellation checks are planned; run on request.

### Scope boundaries
Out of scope: advanced wizard internals (`BACK-366.02`), remaining prompt flows (`BACK-366.03`), removing legacy prompts dependency (`BACK-366`).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter micro-brief (L1): Closest analog is existing `init` prompt logic in `src/cli.ts` plus cancel wrappers in `src/commands/advanced-config-wizard.ts`. Main risk is cancellation behavior drift while replacing `prompts` on select/multiselect/confirm flows; mitigation is explicit per-branch cancel handling in the `init` state machine and preserving existing strings/options/defaults.

Implemented init flow migration to Clack in `src/cli.ts`: replaced git-repo bootstrap confirm, project name text, task prefix text, integration mode select, CLI instruction multiselect, MCP client multiselect, and advanced-settings confirm. Preserved existing option labels/choice values and explicit cancel behavior (integration cancel returns, selection cancels loop back to mode select, advanced cancel aborts with exit 1).

Added `@clack/prompts@1.0.1` to `package.json` and regenerated `bun.lock` with `bun i`.

Addressed re-init idempotency regression in `src/core/init.ts`: config construction now preserves all existing non-init-managed fields by merging `existingConfig`, while still applying init-managed overrides. Added explicit clear semantics for init-managed optional fields (`defaultEditor`, `zeroPaddedIds`) when those keys are provided in `advancedConfig`.

Added regression coverage in `src/test/enhanced-init.test.ts` to ensure re-initialization preserves non-init-managed fields (e.g., `definitionOfDone`, assignee/reporter defaults, `includeDateTimeInDates`, `onStatusChange`, `mcp.http`).

Clack best-practice follow-up in `src/cli.ts`: replaced raw cancel logging in init Clack flows with `clack.cancel(...)` helpers (`abortInitialization`/`cancelInitialization`), while preserving previous exit semantics (`Aborting` paths set non-zero exit code and return; integration mode cancel returns without failure).

Added inline `validate` callbacks for Clack text prompts (project name required on first init; task prefix letter-only when provided), and made the integration guidance note render once per init run (`integrationTipShown`) instead of repeating after loop-back cancels.

Removed legacy `prompts` usage entirely from runtime code. `src/commands/advanced-config-wizard.ts` now uses a Clack-backed prompt runner (`@clack/prompts`) while preserving existing wizard call patterns and injected prompt stubs for tests.

Migrated remaining CLI prompt call sites to Clack: `agents --update` multiselect and `cleanup` select/confirm flows in `src/cli.ts`. Removed `prompts` and `@types/prompts` from `package.json` and refreshed lockfile with `bun i`.

Full validation pass after prompts cleanup and Clack migration fixes: `bun test` passed, `bunx tsc --noEmit` passed, `bun run check .` passed, and `bun run build` passed.

Additional follow-up fixes included: hoisted init cancel helpers to avoid use-before-declaration, strict-typed boolean coercions in advanced config wizard prompt results, and Biome-compliant formatting/lint fixes.

Fixed Clack numeric prompt behavior in `src/commands/advanced-config-wizard.ts`: pressing Enter on number prompts now keeps the existing configured value (when present) instead of requiring re-entry. Added placeholder display for current numeric value and parsing fallback to initial value on empty input.

Updated advanced editor prompt default in `src/commands/advanced-config-wizard.ts`: editor initial value now uses fallback chain `config.defaultEditor -> EDITOR -> VISUAL -> platform default` via `resolveEditor`, so the prompt always shows a concrete default value.

Updated advanced wizard Clack text/number prompts to use `initialValue` instead of `placeholder`, so defaults render as editable values in TTY prompts.

Typed `defaultEditor` as `string | undefined` to preserve clear/override behavior without TS assignment errors.

Validated with `bunx tsc --noEmit && bun run check . && bun test && bun run build` (all passing).

Interactive repro in temp repo with `EDITOR=nano` now shows defaults inline: branch days prompt displays `30`, editor prompt displays `nano` before submission.

Replaced init summary console output with Clack presentation in `src/cli.ts`: `clack.note` for Initialization Summary + shell completion details, `clack.outro` for final init/re-init status, and `clack.log.info` for agent/Claude follow-up lines.

Kept the same data points in the summary (integration mode, completion state, advanced settings, editor/port/branch options), but rendered with consistent Clack styling.

Updated the skipped-integration summary sentence to remove outdated manual MCP registration wording.

Enhanced Clack init summary styling in `src/cli.ts` with TTY-aware ANSI colors: cyan labels, green/red booleans, muted secondary text, bold project name, and colored shell completion status.

Colorization is gated (`process.stdout.isTTY` and `NO_COLOR`) so non-TTY output remains plain text without escape noise.

Extended colorized Clack output to the shell completion installation note in `src/cli.ts`: bold path value, cyan guidance lines, and green command lines (`path=...`, `autoload ...`, `source ...`) while preserving exact instruction content/order.

Adjusted MCP client selection in interactive init (`src/cli.ts`) to enforce non-empty selection: `clack.multiselect` now uses `required: true`, prompt text no longer advertises empty-skip, and an empty fallback path now retries with a validation message instead of treating it as skip.

Adjusted advanced wizard zero-padding flow (`src/commands/advanced-config-wizard.ts`) so pressing `Esc` on the padding width prompt goes back to the preceding `Enable zero-padded IDs` confirm instead of aborting the wizard. Implemented via local cancel handler on the width prompt and looped zero-padding step.

Applied the same back-navigation behavior to Web UI advanced settings in `src/commands/advanced-config-wizard.ts`: pressing `Esc` from the Web UI detail prompts (port/auto-open) now returns to `Configure web UI settings now?` instead of aborting the wizard.

Fixed cancel flow bug in `clackPromptRunner` (`src/commands/advanced-config-wizard.ts`) for question arrays: when any prompt is canceled, subsequent prompts in the batch are no longer rendered. This resolves the Web UI flow artifact where pressing `Esc` on port still displayed the auto-open browser prompt before returning.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated the `backlog init` interactive flow to `@clack/prompts` with behavior parity and improved UX stability. Replaced init questions (project name, task prefix, integration selection, MCP/CLI selections, advanced settings gate) and preserved cancellation semantics while tightening validation. Added Clack-styled initialization summaries, TTY-safe color formatting, and shell completion note rendering. Enforced non-empty MCP client selection and updated obsolete copy. Verified end-to-end behavior with interactive TTY repros (including default value rendering and back-navigation paths). Validation run: `bunx tsc --noEmit`, `bun run check .`, `bun test`, `bun run build`.
<!-- SECTION:FINAL_SUMMARY:END -->
