---
id: BACK-393
title: 'CLI task create/edit: unified Clack wizard with edit prefill'
status: Done
assignee:
  - '@codex'
created_date: '2026-02-20 23:29'
updated_date: '2026-02-21 20:02'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/utils/task-edit-builder.ts
  - src/core/backlog.ts
  - src/test/test-helpers.ts
  - src/test/acceptance-criteria.test.ts
  - src/test/definition-of-done-cli.test.ts
  - src/test/cli-plain-create-edit.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: current task create/task edit require correctly composed args and fail fast when required positional args are missing, which hurts interactive UX.
What: add one shared wizard engine for both create and edit; task edit preloads current task values, and both commands use the same field and validation logic under the hood.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A shared CLI task wizard implementation powers both create and edit flows.
- [x] #2 In TTY, `backlog task create` opens the wizard by default.
- [x] #3 In TTY, `backlog task edit` opens the wizard by default; with task ID it opens prefilled, and without task ID it shows a task picker then opens prefilled.
- [x] #4 Wizard supports core field parity with existing CLI args: title, description, status, priority, assignee, labels, acceptance criteria, Definition of Done, plan, notes, references/docs, and dependencies.
- [x] #5 Existing script and automation flows remain available via non-interactive mode and preserve current validation and error behavior.
- [x] #6 Data mutations continue to use existing core create and edit pathways without changing task model semantics.
- [x] #7 Automated tests cover create wizard happy path, edit wizard prefill path, edit-without-id picker path, non-interactive backward compatibility, and cancel/validation flows.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Complexity: L2 (cross-module CLI behavior + shared wizard engine + compatibility/test coverage).

Context brief (context-hunter):
- Closest analog for injectable interactive flow is `src/commands/advanced-config-wizard.ts` (prompt runner abstraction, cancel handling, test stubs).
- Current task create/edit flows are in `src/cli.ts` and diverge today (separate option parsing/build paths).
- Shared edit input normalization already exists in `src/utils/task-edit-builder.ts`; list/index parsing helpers live in `src/utils/task-builders.ts`.
- Core semantics that must remain unchanged are in `src/core/backlog.ts` (`createTask`, `createTaskFromInput`, `editTask`/`updateTaskFromInput`, AC/DoD mutation rules).
- Existing regression surfaces are covered mostly by `src/test/acceptance-criteria.test.ts`, `src/test/definition-of-done-cli.test.ts`, `src/test/task-edit-preservation.test.ts`, and `src/test/cli-plain-create-edit.test.ts`.

Implementation plan by acceptance criterion:

1) AC1 - Shared wizard engine powers create and edit
- Add a new shared wizard module (expected: `src/commands/task-wizard.ts`) that defines one field model and one prompt pipeline for both modes (`create` and `edit`).
- Implement one normalized wizard result shape and mode-specific adapters (create payload vs edit payload) so field parsing/validation is shared.
- Reuse the same normalization helpers used by CLI flag paths (`normalizeStringList`, `normalizeDependencies`, status/priority validation) to prevent drift.

2) AC2 - TTY `task create` opens wizard by default
- Update `task create` command in `src/cli.ts` to accept optional title (instead of required positional at parser level) and branch behavior:
  - TTY + no non-interactive field flags => launch shared wizard.
  - Non-TTY or explicit non-interactive intent => preserve current flag-driven path.
- Keep `--plain` output behavior unchanged after successful create.

3) AC3 - TTY `task edit` opens wizard by default (+ picker when no ID)
- Update `task edit` command in `src/cli.ts` to accept optional task id and branch behavior:
  - TTY with task id => load task and open prefilled wizard.
  - TTY without task id => show task picker (local editable tasks only), then open prefilled wizard.
  - Non-TTY => preserve current non-interactive behavior/errors.
- Ensure cancel from picker/wizard exits cleanly without mutation.

4) AC4 - Wizard field parity with current CLI args
- Implement shared wizard fields for: title, description, status, priority, assignee, labels, acceptance criteria, Definition of Done, plan, notes, references, documentation, dependencies.
- Use prefill for edit from existing task values.
- Validate status against configured statuses and priority against `high|medium|low`.
- Parse multi-value fields consistently (comma/newline handling) and keep empty-input semantics aligned with current CLI behavior.

5) AC5 - Non-interactive/script compatibility preserved
- Keep existing non-interactive create/edit code path intact in `src/cli.ts` (current flag parsing, validations, and error strings).
- Only route to wizard when interactive preconditions are met.
- Preserve backward compatibility for automation (`--plain`, existing flags, existing validation failures).

6) AC6 - Mutations continue through existing core pathways
- Do not introduce new persistence path.
- Create flow continues to end in existing core create APIs.
- Edit flow continues to end in existing core edit APIs with `TaskUpdateInput` semantics preserved.
- Avoid task model/schema changes.

7) AC7 - Automated test coverage for wizard + compatibility
- Add focused wizard tests with prompt stubs (expected: `src/test/task-wizard.test.ts`) covering:
  - create wizard happy path
  - edit wizard prefill path
  - edit-without-id picker path
  - cancel behavior
  - field validation behavior
- Add/extend CLI-focused tests (expected: `src/test/cli-task-wizard.test.ts` and/or updates in `src/test/cli-plain-create-edit.test.ts`) for non-interactive backward compatibility and `--plain` behavior.
- Reuse existing regression suites for AC/DoD/preservation compatibility.

Expected files to change:
- `src/cli.ts`
- `src/commands/task-wizard.ts` (new)
- `src/test/task-wizard.test.ts` (new)
- `src/test/cli-task-wizard.test.ts` (new) and/or `src/test/cli-plain-create-edit.test.ts`
- Potential small helper touchpoints only if required for reuse: `src/utils/task-builders.ts`, `src/utils/task-edit-builder.ts`

Verification plan (mapped to DoD):
- DoD #1 (TypeScript): `bunx tsc --noEmit`
- DoD #2 (format/lint): `bun run check .`
- DoD #3 (tests):
  - `bun test src/test/task-wizard.test.ts`
  - `bun test src/test/cli-plain-create-edit.test.ts`
  - `bun test src/test/acceptance-criteria.test.ts`
  - `bun test src/test/definition-of-done-cli.test.ts`
  - `bun test src/test/task-edit-preservation.test.ts`
  - then `bun test` if targeted suite passes

Post-implementation simplification checkpoint:
- After green tests, review for duplicate parsing/validation branches and collapse to a single shared helper where possible without changing behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation in dedicated branch `tasks/back-393-unified-task-wizard`.
Decision: introduce a shared `src/commands/task-wizard.ts` prompt pipeline with injectable prompt runner for testability, while preserving existing non-interactive create/edit code paths in `src/cli.ts`.
Compatibility guardrail: wizard is only entered for interactive default paths; legacy flag-driven behavior and plain/non-TTY automation path remain intact.

Implemented shared wizard engine in `src/commands/task-wizard.ts` and wired `task create` / `task edit` in `src/cli.ts` to use wizard only for interactive default paths.
Behavior guardrails: when non-interactive flags are present (or non-TTY), create/edit continue through the existing CLI argument parsing and core mutation paths.
Implemented edit-without-id picker path via `pickTaskForEditWizard` before prefilled edit flow.
TS18048 baseline encountered in `src/cli.ts` (`arg` possibly undefined in `getMcpStartCwdOverrideFromArgv`), fixed with a narrow undefined guard consistent with BACK-393 scope.
Additional strictness fixes were limited to the new wizard module (prompt validate signatures and noUncheckedIndexedAccess-safe checks).

Verification evidence:
- `bunx tsc --noEmit` ✅ pass.
- `bun run check .` ✅ pass (Biome check clean).
- `bun test src/test/task-wizard.test.ts` ✅ 5 pass / 0 fail.
- `bun test src/test/cli-task-wizard.test.ts` ✅ 3 pass / 0 fail.
- `bun test src/test/cli-plain-create-edit.test.ts` ✅ 2 pass / 0 fail.
- `bun test src/test/definition-of-done-cli.test.ts` ✅ 4 pass / 0 fail.
- `bun test src/test/task-edit-preservation.test.ts` ✅ 5 pass / 0 fail.
- `bun test src/test/acceptance-criteria.test.ts` ✅ 32 pass / 0 fail.

Additional context:
- A full `bun test` run was attempted; it failed on unrelated baseline path-normalization assertions in `src/test/runtime-cwd.test.ts` (`/var` vs `/private/var`), outside BACK-393 scope. Scoped verification above remains green for all impacted create/edit surfaces.

Follow-up scope for PR #539 (BACK-393 continuation):
- Replace free-text priority prompt with selector/dropdown.
- Replace free-text status prompt with selector; default should be "To Do" for create flow while preserving edit prefill.
- Update Definition of Done prompt label to clearly indicate it is per-task DoD (project-level DoD configured elsewhere).
- Assess Shift+Enter newline behavior in wizard text fields and, if low-risk, enable for description/plan/notes; otherwise document limitation and add explicit guidance in prompt labels.

Implementation constraint: keep changes minimal/coherent in shared wizard module and tests; ignore unrelated workspace edits.

Follow-up implementation for PR #539 completed:
- Status prompt now uses selector in wizard, with create default preferring "To Do" (fallback to first configured status).
- Priority prompt now uses selector in wizard (`None`, `High`, `Medium`, `Low`).
- Definition of Done prompt label now explicitly indicates this is per-task DoD and that project-level DoD is configured elsewhere.
- Shift+Enter newline support assessment: not feasible with low risk using current `@clack/prompts` text input (single-line prompt semantics). Added explicit prompt guidance on description/implementation plan/implementation notes that Shift+Enter is not supported.

Files touched:
- src/commands/task-wizard.ts
- src/test/task-wizard.test.ts

Verification (requested suite):
- bun test src/test/task-wizard.test.ts src/test/cli-task-wizard.test.ts src/test/cli-plain-create-edit.test.ts src/test/definition-of-done-cli.test.ts src/test/task-edit-preservation.test.ts src/test/acceptance-criteria.test.ts ✅
- bunx tsc --noEmit ✅
- bun run check . ✅

Follow-up patch for PR #539: wizard status selector now mirrors MCP `task_create` status semantics by always allowing `Draft` while keeping create defaults non-draft (`To Do` when available).

Implementation: `src/commands/task-wizard.ts` now builds status selector options from configured statuses (or `DEFAULT_STATUSES` fallback), prepends `Draft` when missing, and computes create/edit default from base statuses.

Tests updated in `src/test/task-wizard.test.ts` to assert status selector options include `Draft`, and create default remains `To Do` (including empty-status fallback scenario).

Verification rerun (requested suite) passed: `bun test src/test/task-wizard.test.ts src/test/cli-task-wizard.test.ts src/test/cli-plain-create-edit.test.ts src/test/definition-of-done-cli.test.ts src/test/task-edit-preservation.test.ts src/test/acceptance-criteria.test.ts`, `bunx tsc --noEmit`, `bun run check .`.

2026-02-21 follow-up scope (PR #539 patch): implement safe Backspace-on-empty navigation for text prompts only in task wizard. Constraints: keep cancel semantics (Ctrl+C/Esc full cancel), do not affect select prompts, keep wizard API and CLI integration stable.

2026-02-21 follow-up patch (PR #539): implemented safe Backspace-to-previous-prompt behavior for task wizard text prompts only. Behavior: Backspace on empty text input navigates to previous prompt when one exists; first prompt Backspace-empty is a no-op; non-empty Backspace remains normal delete; Ctrl+C/Esc cancel behavior unchanged.

Implementation details: switched wizard text handling to @clack/core TextPrompt key events inside src/commands/task-wizard.ts and refactored runTaskWizardValues to indexed prompt traversal so text prompts can request previous-step navigation without affecting select prompts or CLI integration.

2026-02-21 CI-fix follow-up for PR #539: resolved module-resolution failures (`Cannot find module '@clack/core'` / `Cannot find module 'picocolors'` from task wizard import path) by adding explicit devDependencies for `@clack/core@1.0.1` and `picocolors@1.1.1` in `package.json` and refreshing `bun.lock`.

Verification evidence (branch `tasks/back-393-unified-task-wizard`):
- `bun test src/test/task-wizard.test.ts src/test/cli-task-wizard.test.ts src/test/cli-plain-create-edit.test.ts src/test/definition-of-done-cli.test.ts src/test/task-edit-preservation.test.ts src/test/acceptance-criteria.test.ts` ✅ (56 passed, 0 failed)
- `bunx tsc --noEmit` ✅
- `bun run check .` ✅
- `VER="$(jq -r .version package.json)" && bun build src/cli.ts --compile --minify --target=bun-linux-x64-baseline --define __EMBEDDED_VERSION__="\"${VER}\"" --outfile=backlog-test-ci-smoke` ✅

Behavior-preservation note: wizard logic was intentionally unchanged, so status/priority selectors, per-task DoD label copy, and Backspace-empty previous prompt behavior remain intact.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a unified Clack wizard engine for CLI task create/edit while preserving existing non-interactive behavior.

What changed:
- Added shared wizard module `src/commands/task-wizard.ts` that powers both create and edit with shared field prompts, shared normalization/parsing, edit prefill support, picker support for edit-without-id, and cancel handling.
- Updated CLI wiring in `src/cli.ts`:
  - `task create` now accepts optional title and opens the wizard by default in interactive TTY when no non-interactive flags are provided.
  - `task edit` now accepts optional task ID and opens the wizard by default in interactive TTY when no non-interactive flags are provided; with no ID it shows a picker and then opens prefilled edit wizard.
  - Non-interactive/script paths retain existing option parsing, validation behavior, and mutation pathways.
- Added tests:
  - `src/test/task-wizard.test.ts` for create happy path, edit prefill path, picker path, cancel handling, and validation behavior.
  - `src/test/cli-task-wizard.test.ts` for non-interactive backward compatibility (missing arg errors and legacy edit behavior).
- Addressed encountered baseline strictness issue in-scope:
  - Fixed `TS18048` in `src/cli.ts` by guarding potentially undefined `arg` in `getMcpStartCwdOverrideFromArgv`.

Verification evidence:
- `bunx tsc --noEmit` ✅
- `bun run check .` ✅
- `bun test src/test/task-wizard.test.ts` ✅ (5 pass, 0 fail)
- `bun test src/test/cli-task-wizard.test.ts` ✅ (3 pass, 0 fail)
- `bun test src/test/cli-plain-create-edit.test.ts` ✅ (2 pass, 0 fail)
- `bun test src/test/definition-of-done-cli.test.ts` ✅ (4 pass, 0 fail)
- `bun test src/test/task-edit-preservation.test.ts` ✅ (5 pass, 0 fail)
- `bun test src/test/acceptance-criteria.test.ts` ✅ (32 pass, 0 fail)
- `bun test` was also attempted and exposed unrelated baseline failures in `src/test/runtime-cwd.test.ts` (`/var` vs `/private/var`) outside BACK-393 scope.

PR:
- https://github.com/MrLesk/Backlog.md/pull/539

Follow-up improvements for PR #539:
- Replaced free-text status/priority inputs in the shared task wizard with selectors.
  - Status selector now defaults to `To Do` for create flow (or first configured status if `To Do` is unavailable).
  - Priority selector now provides explicit options (`None`, `High`, `Medium`, `Low`).
- Updated DoD wizard copy to clarify this is **per-task Definition of Done** and project-level DoD is configured separately.
- Evaluated Shift+Enter newline support in wizard text fields and kept implementation low-risk:
  - Current `@clack/prompts` text prompt is single-line; Shift+Enter newline is not safely supported in current abstraction.
  - Added explicit guidance text on description/plan/notes prompts indicating Shift+Enter is not supported.

Scoped verification is fully green (tests + type-check + Biome).

Follow-up patch for PR #539 (BACK-393): Added safe Backspace-to-previous behavior in task wizard text prompts only, preserving existing cancel semantics and leaving selectors unchanged.

Updated tests in src/test/task-wizard.test.ts to cover: step N -> N-1 back navigation on Backspace-empty, first-step Backspace-empty no-op, and cancel flow still returns null.

Verification rerun passed: bun test src/test/task-wizard.test.ts src/test/cli-task-wizard.test.ts src/test/cli-plain-create-edit.test.ts src/test/definition-of-done-cli.test.ts src/test/task-edit-preservation.test.ts src/test/acceptance-criteria.test.ts; bunx tsc --noEmit; bun run check .
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
