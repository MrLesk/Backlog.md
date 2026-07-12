---
id: BACK-392
title: 'CLI advanced config: interactive Definition of Done defaults editor'
status: Done
assignee:
  - '@codex'
created_date: '2026-02-20 23:29'
updated_date: '2026-02-21 17:33'
labels: []
dependencies: []
references:
  - src/commands/advanced-config-wizard.ts
  - src/commands/configure-advanced-settings.ts
  - src/cli.ts
  - src/file-system/operations.ts
  - src/test/enhanced-init.test.ts
  - src/test/definition-of-done.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: after moving init/config prompts to Clack, Definition of Done defaults still require manual config edits or Web UI settings.
What: extend advanced config wizard flows to support interactive editing of definition_of_done using a guided list editor (add/remove/reorder/clear with preview), and persist ordered values to config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Advanced config flow includes an explicit Definition of Done defaults step in both init advanced setup and standalone advanced configuration command path.
- [x] #2 Definition of Done step uses guided list editing with add, remove by index, reorder, clear all, and done actions.
- [x] #3 Existing Definition of Done defaults are prefilled when present; empty config starts from an empty list.
- [x] #4 Saved Definition of Done values are trimmed, non-empty, and order-preserving in config serialization.
- [x] #5 Wizard cancel and back behavior remains consistent with existing Clack navigation semantics.
- [x] #6 Automated tests cover init flow, standalone advanced config flow, and config round-trip persistence for Definition of Done defaults.
- [x] #7 Help and docs text for advanced config is updated to mention the Definition of Done configuration path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context-Hunter Discovery (L2)
- Complexity: **L2 high-risk** (changes span CLI wizard flow, init pipeline, config persistence semantics, tests, and docs/help text).
- Closest analogs reviewed:
  - `src/commands/advanced-config-wizard.ts` (existing guided flow, cancel/back semantics via `onCancel`, loop-back patterns used by zero-padding and web UI prompts).
  - `src/commands/configure-advanced-settings.ts` (standalone `backlog config` path merges wizard output and persists config).
  - `src/cli.ts` (init advanced prompt path + config command summaries/help messaging).
  - `src/core/init.ts` (init-time advanced config merge/preservation behavior).
  - `src/file-system/operations.ts` + `src/test/definition-of-done.test.ts` (config serialization/parsing for `definition_of_done`).
- Key risk/ambiguity to handle explicitly:
  - Preserving existing DoD defaults when wizard is not used, while still allowing explicit **clear all** when wizard is used.
  - Keeping existing Clack cancel/back behavior consistent (cancel exits top-level flow; nested editor actions can return to the action menu).

## Implementation Plan
1. Add a dedicated Definition of Done defaults step to the advanced wizard (covers AC #1, #2, #3, #5).
- File: `src/commands/advanced-config-wizard.ts`
- Add wizard state for `definitionOfDone` seeded from existing config (or empty list when absent).
- Add a guided action loop with actions: `add`, `remove by index`, `reorder`, `clear all`, `done`, plus preview of current ordered list each cycle.
- Use existing local loop-back pattern (`goBack...`) for nested prompts so cancel/back behavior matches current semantics.
- Ensure saved list normalization is trim + non-empty filter, preserving entered order.

2. Thread DoD defaults through init advanced setup and standalone advanced config persistence (covers AC #1, #4).
- Files:
  - `src/cli.ts`
  - `src/core/init.ts`
  - `src/commands/configure-advanced-settings.ts` (verify behavior; adjust only if needed)
- Init path: include `definitionOfDone` in advanced config handoff to shared init so init advanced setup can persist wizard-edited DoD defaults.
- Preserve existing config behavior when advanced wizard is skipped; support explicit clear (`[]`) when wizard performs clear-all.
- Keep serialization path order-preserving by passing normalized list as-is into config save.

3. Update user-facing help/docs to surface the new DoD advanced-config path (covers AC #7).
- Files:
  - `README.md`
  - `CLI-INSTRUCTIONS.md`
  - `ADVANCED-CONFIG.md`
  - `src/cli.ts` (summary/help/error text for config UX where relevant)
- Update text that currently implies DoD defaults must be edited only via file/Web UI; mention interactive `backlog config`/init advanced wizard path.

4. Add/adjust automated tests for init path, standalone advanced config path, and DoD config persistence (covers AC #6).
- Files:
  - `src/test/config-commands.test.ts`
  - `src/test/enhanced-init.test.ts`
  - `src/test/definition-of-done.test.ts`
- Test focus:
  - Standalone `configureAdvancedSettings` flow persists guided DoD list edits.
  - Init flow persists advanced-config DoD defaults through shared init pipeline.
  - Round-trip persistence maintains trimmed, non-empty, order-preserving DoD values.
  - Back/cancel regression checks for new nested DoD editor prompts follow existing wizard behavior.

## Acceptance Criteria Mapping
- AC #1: Steps 1 + 2 (wizard step added; threaded through init and standalone config paths).
- AC #2: Step 1 (guided list editor includes add/remove/reorder/clear/done).
- AC #3: Step 1 (prefill from existing config; empty list start when unset).
- AC #4: Steps 1 + 2 (normalization + ordered persistence).
- AC #5: Step 1 (reuse existing Clack cancel/back loop semantics).
- AC #6: Step 4 (targeted automated tests across init, standalone config, round-trip).
- AC #7: Step 3 (CLI/help/docs updated to mention DoD configuration path).

## Verification Plan (Definition of Done)
- DoD #1 TypeScript: `bunx tsc --noEmit`
- DoD #2 Lint/format: `bun run check .`
- DoD #3 Tests:
  - `bun test src/test/config-commands.test.ts`
  - `bun test src/test/enhanced-init.test.ts`
  - `bun test src/test/definition-of-done.test.ts`
  - plus `bun test` if broad regression confidence is needed after touched areas are stable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation started after TPM approval. Working in dedicated clone `../Backlog.md-copies/backlog-392` on branch `tasks/back-392-dod-defaults-editor` with scope limited to BACK-392 AC/DoD.

Execution order: (1) advanced wizard DoD editor + semantics, (2) init/config wiring + persistence safeguards, (3) tests, (4) docs/help text, (5) verification + retrospective simplification.

Implemented wizard-side DoD list editor in `runAdvancedConfigWizard` with actions add/remove/reorder/clear/done and live preview text. Nested prompts use local `goBack...` cancel handlers to return to the DoD action menu while top-level cancel still exits wizard.

Wired DoD defaults through init/config persistence: `cli.ts` passes `definitionOfDone` in advanced config, `core/init.ts` now treats it as an init-managed optional override with explicit clear support (`[]`), and config serialization now trims + drops empty DoD entries while preserving order.

Retrospective simplification pass: kept all list-editing behavior inside existing `advanced-config-wizard.ts` flow using current `PromptRunner` abstractions (no new service/layer), and reused existing init/config merge patterns in `core/init.ts` instead of adding new persistence pathways.

Verification evidence (scoped): `bun test src/test/config-commands.test.ts src/test/enhanced-init.test.ts src/test/definition-of-done.test.ts` -> PASS (30 tests, 0 fail).

Verification evidence (typecheck): `bunx tsc --noEmit` -> PASS (exit code 0).

Verification evidence (lint/format): `bun run check .` -> PASS (`Checked 243 files ... No fixes applied`).

PR created: https://github.com/MrLesk/Backlog.md/pull/537

TPM follow-up: Reopened to address PR review comment https://github.com/MrLesk/Backlog.md/pull/537#discussion_r2836351386. Required fix: guard Definition of Done normalization against non-string entries to avoid TypeError from malformed API input (e.g., [1, null]).

TPM follow-up fix completed for PR review comment https://github.com/MrLesk/Backlog.md/pull/537#discussion_r2836351386.

Implemented a minimal guard in `src/file-system/operations.ts` to normalize `definitionOfDone` safely by filtering non-string entries before trim in both `saveConfig` and `serializeConfig`, preventing TypeError on malformed payloads like `[1, null]`.

Added regression coverage for malformed DoD values through config persistence paths: `src/test/definition-of-done.test.ts` (save/reload with non-string entries) and `src/test/enhanced-init.test.ts` (initializeProject advancedConfig with non-string entries).

Verification evidence:

- `bun test src/test/definition-of-done.test.ts src/test/enhanced-init.test.ts src/test/config-commands.test.ts` -> PASS (31 pass, 0 fail).

- `bunx tsc --noEmit` -> PASS (exit code 0).

- `bun run check .` -> PASS (`Checked 243 files in 91ms. No fixes applied.`).

Commit: `b86e9e5` on branch `tasks/back-392-dod-defaults-editor` (pushed to origin).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented interactive Definition of Done defaults editing in CLI advanced configuration flows.

What changed:
- Added a dedicated DoD defaults step in `src/commands/advanced-config-wizard.ts` used by both init advanced setup and `backlog config`.
- Implemented guided actions: add item, remove by index, reorder, clear all, and done, with a live ordered preview.
- Preserved existing Clack cancel semantics: top-level cancel exits wizard; nested DoD action prompts cancel back to the DoD action menu.
- Wired `definitionOfDone` through init advanced-config persistence in `src/cli.ts` and `src/core/init.ts`, including explicit clear support (`[]`).
- Normalized config persistence in `src/file-system/operations.ts` so saved DoD defaults are trimmed, non-empty, and order-preserving.
- Updated advanced config documentation/help text in `README.md`, `CLI-INSTRUCTIONS.md`, `ADVANCED-CONFIG.md`, and config-set guidance in `src/cli.ts`.
- Added test coverage in:
  - `src/test/config-commands.test.ts` (standalone advanced config flow + DoD action coverage)
  - `src/test/enhanced-init.test.ts` (init advanced-config persistence + clear behavior)
  - `src/test/definition-of-done.test.ts` (round-trip normalization and ordering)

Verification run:
- `bun test src/test/config-commands.test.ts src/test/enhanced-init.test.ts src/test/definition-of-done.test.ts` (PASS: 30 passed, 0 failed)
- `bunx tsc --noEmit` (PASS)
- `bun run check .` (PASS)

PR:
- https://github.com/MrLesk/Backlog.md/pull/537
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
