---
id: BACK-367.01
title: CLI and plain text formatter integration for Final Summary field
status: Done
assignee:
  - '@codex'
created_date: '2026-01-18 12:19'
updated_date: '2026-01-19 18:27'
labels:
  - cli
  - enhancement
dependencies:
  - BACK-367
documentation:
  - src/cli.ts
  - src/formatters/task-plain-text.ts
parent_task_id: BACK-367
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Scope

Integrate the `finalSummary` field into the CLI commands and plain text output formatter.

**Depends on:** BACK-367 (core infrastructure must be complete first)

### CLI Commands

**`task create` command:**
- Add `--final-summary <text>` flag to set initial final summary

**`task edit` command:**
- Add `--final-summary <text>` flag to set/replace final summary
- Add `--append-final-summary <text>` flag to append to existing final summary
- Add `--clear-final-summary` flag to remove final summary

Follow the same patterns used for `--plan`, `--notes`, `--append-notes`, `--clear-notes`.

### Plain Text Formatter

Update `src/formatters/task-plain-text.ts` to display the Final Summary section:
- Display after Implementation Notes
- Use consistent formatting with other sections
- Only show if finalSummary is non-empty

### Reference Files

- `src/cli.ts` - CLI command definitions and option parsing
- `src/formatters/task-plain-text.ts` - Plain text output formatting
- Look at how `--notes`, `--append-notes`, `--plan` flags are implemented
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI `task create` supports `--final-summary <text>` flag
- [x] #2 CLI `task edit` supports `--final-summary <text>` flag (set/replace)
- [x] #3 CLI `task edit` supports `--append-final-summary <text>` flag
- [x] #4 CLI `task edit` supports `--clear-final-summary` flag
- [x] #5 Plain text formatter displays Final Summary section after Implementation Notes when present
- [x] #6 Plain text formatter omits Final Summary section when field is empty
- [x] #7 CLI tests in `src/test/cli-final-summary.test.ts` cover all flag combinations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Review CLI flags for notes/plan in `src/cli.ts` and mirror patterns for `--final-summary`, `--append-final-summary`, `--clear-final-summary` in create/edit flows.
- Wire new args through `src/types/task-edit-args.ts` and `src/utils/task-edit-builder.ts` to map to `finalSummary`, `appendFinalSummary`, `clearFinalSummary`.
- Update `src/formatters/task-plain-text.ts` to render Final Summary after Implementation Notes only when present.
- Add CLI-focused tests in `src/test/cli-final-summary.test.ts` and/or extend existing CLI plain output tests to cover set/append/clear and section ordering.
- Run targeted tests: `bun test src/test/cli-final-summary.test.ts` (plus any updated test files).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Added CLI flags for final summary on create/edit, wired task edit inputs, and surfaced Final Summary in plain text output. Added CLI tests for create/set/append/clear and plain output ordering.

Tests: bun test src/test/cli-final-summary.test.ts
<!-- SECTION:NOTES:END -->
