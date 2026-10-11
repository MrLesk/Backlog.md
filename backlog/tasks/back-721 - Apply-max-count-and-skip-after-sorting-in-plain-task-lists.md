---
id: BACK-721
title: Apply --max-count and --skip after sorting in plain task lists
status: To Do
assignee: []
created_date: '2026-10-11 10:42'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1059'
type: bug
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --plain` takes the `--max-count` and `--skip` window over the status-grouped display order instead of over the sorted list. With `--sort ordinal --max-count 2`, `--json` returns the first two tasks by ordinal, while `--plain` returns two different tasks whenever one of the first two sits in a status group that prints later (issue #1059, reproduced on 1.53.0). The same flags therefore select different tasks depending on the output format, and plain output contradicts the help text, which says the window is taken after filtering and sorting. The older `--limit` option already selects after the sort and only regroups the selected tasks for display.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For the same filters, `--sort`, `--max-count`, and `--skip`, `backlog task list --plain` lists exactly the tasks that `--json` returns.
- [ ] #2 Plain output regroups only the selected tasks by status for display, as `--limit` already does.
- [ ] #3 The reproduction from the issue (four tasks with ordinals 10, 20, 30, and 40, the first one In Progress, then `backlog task list --plain --sort ordinal --max-count 2`) lists TASK-1 and TASK-2.
- [ ] #4 The shown range, the total, and the printed Next command in plain output agree with the `total` and `nextSkip` that `--json` reports for the same flags.
- [ ] #5 `--json` output and `--limit` behavior are unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
