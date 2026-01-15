---
id: task-24.1
title: 'CLI: Kanban board milestone view'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-09'
updated_date: '2025-12-17 21:47'
labels: []
dependencies: []
parent_task_id: task-24
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a backlog board view --milestones or -m to view the board based on milestones (non-TTY/markdown output only)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog board view --milestones` or `-m` outputs milestone-grouped markdown when piped or in non-TTY mode
- [x] #2 Documentation updated if necessary
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Add `-m/--milestones` flag to `backlog board view`
- Group tasks by milestone (including "No milestone") in milestone view output
- Update docs/help text for the new flag
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added -m/--milestones flag to CLI board command. When used with non-TTY output (piped to file or `| cat`), generates milestone-grouped markdown board. The flag is passed to the TUI but milestone swimlanes are NOT implemented in the interactive terminal view - the flag is effectively ignored in TTY mode.

DoD verification: ran `bun test`, `bunx tsc --noEmit`, `bun run check .`.
<!-- SECTION:NOTES:END -->
