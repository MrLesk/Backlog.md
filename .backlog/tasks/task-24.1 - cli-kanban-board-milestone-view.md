---
id: task-24.1
title: 'CLI: Kanban board milestone view'
status: Done
assignee:
  - '@codex'
created_date: '2025-06-09'
updated_date: '2025-06-10'
labels: []
dependencies: []
parent_task_id: task-24
---

## Description

Add a backlog board view --milestones or -m to view the board based on milestones

## Acceptance Criteria

- [x] `backlog board view --milestones` or `-m` groups tasks by milestone
- [x] Documentation updated if necessary

## Implementation Notes

- Added `--milestones` and `-m` option to the board view command
- Modified `addBoardOptions` function to include the milestone option
- Updated `handleBoardView` to accept `milestones` option and pass appropriate groupBy parameter to `generateKanbanBoard`
- The board.ts already had support for grouping by milestone via the `groupBy` parameter
- Tests were already in place for both CLI and board functionality
- Updated readme.md to document the `-m` shorthand option
