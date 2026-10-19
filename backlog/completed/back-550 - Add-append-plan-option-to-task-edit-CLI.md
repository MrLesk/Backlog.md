---
id: BACK-550
title: Add append-plan option to task edit CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-07-17 06:45'
updated_date: '2026-07-17 22:45'
labels:
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/792'
  - 'https://github.com/MrLesk/Backlog.md/pull/793'
modified_files:
  - src/cli.ts
  - src/guidelines/cli-instructions/task-execution.md
  - src/test/append-implementation-plan.test.ts
  - src/test/cli-guidance.test.ts
type: enhancement
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add repeatable `--append-plan` support to the canonical `backlog task edit` command so humans and agents can extend an implementation plan without replacing existing content or opening an editor, closing the current parity gap with MCP planAppend while preserving existing edit behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog task edit --append-plan <text>` is a public repeatable option
- [x] #2 Multiple append values are applied in CLI order, with each addition separated from existing or previously appended plan text by exactly one blank line
- [x] #3 Each append preserves internal newlines and whitespace-only values are ignored, consistent with the shared plan append pipeline
- [x] #4 The first nonblank append creates the plan section when the task has no implementation plan
- [x] #5 When `--plan` and `--append-plan` are used together, `--plan` replaces the plan first and append values are then applied in CLI order
- [x] #6 Real CLI tests cover noninteractive and PTY no-editor behavior, including a missing plan and combined replacement plus append
- [x] #7 `backlog task edit --help` and the canonical task-execution guidance document `--append-plan` and its ordering relative to `--plan`
- [x] #8 Existing `--plan`, `--append-notes`, MCP planAppend, and unrelated task edit fields retain their current behavior
- [x] #9 The full test suite, `bunx tsc --noEmit`, `bun run check .`, and `bun run build` pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Wire the repeatable --append-plan option into task edit parsing and interactive edit-field detection while reusing the existing shared plan append pipeline.
2. Add focused real CLI coverage for existing and missing plans, ordered replacement plus append, whitespace filtering, multiline input, and PTY no-editor behavior.
3. Document --append-plan and replacement-before-append ordering in the canonical task-execution guidance, then regenerate or synchronize shipped instruction artifacts as required.
4. Run the focused tests, full test suite, type-check, Biome check, and build; update the task record with objective evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed the focused CLI slice. Added repeatable --append-plan help/schema wiring, documented replacement-before-append ordering in the canonical task-execution guide, and added noninteractive plus real PTY regression coverage. Focused verification passed: bun test src/test/append-implementation-plan.test.ts src/test/cli-guidance.test.ts (23 pass, 0 fail).

Full verification passed: bun test (1729 pass, 4 skip, 0 fail), bunx tsc --noEmit, bun run check . (337 files, no fixes), and bun run build. The focused PTY test ran under a real pseudo-terminal and confirmed --append-plan mutates the plan without entering the interactive edit wizard.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the canonical repeatable `backlog task edit --append-plan` option by wiring the CLI into the existing shared plan-append pipeline. The option preserves ordered blank-line-separated appends, ignores blank input, creates a missing plan, and applies after `--plan` replacement. Updated task edit help and the canonical task-execution guide, with noninteractive and real PTY regression coverage. Verified with 1729 passing tests, type-check, Biome, and the production build.
<!-- SECTION:FINAL_SUMMARY:END -->
