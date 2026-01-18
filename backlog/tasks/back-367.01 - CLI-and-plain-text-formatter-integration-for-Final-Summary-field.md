---
id: BACK-367.01
title: CLI and plain text formatter integration for Final Summary field
status: To Do
assignee: []
created_date: '2026-01-18 12:19'
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
- [ ] #1 CLI `task create` supports `--final-summary <text>` flag
- [ ] #2 CLI `task edit` supports `--final-summary <text>` flag (set/replace)
- [ ] #3 CLI `task edit` supports `--append-final-summary <text>` flag
- [ ] #4 CLI `task edit` supports `--clear-final-summary` flag
- [ ] #5 Plain text formatter displays Final Summary section after Implementation Notes when present
- [ ] #6 Plain text formatter omits Final Summary section when field is empty
- [ ] #7 CLI tests in `src/test/cli-final-summary.test.ts` cover all flag combinations
<!-- AC:END -->
