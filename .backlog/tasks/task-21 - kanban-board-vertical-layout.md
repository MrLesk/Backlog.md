---
id: task-21
title: Kanban board vertical layout
status: Done
assignee: []
reporter: '@MrLesk'
created_date: '2025-06-09'
updated_date: '2025-06-09'
completed_date: '2025-06-09'
labels: []
dependencies: []
---

## Description

Add a visualization to the Kanban board where all status columns are displayed vertically in a single column.

## Acceptance Criteria

- [x] Vertical Kanban view with all statuses in a single column
- [x] Documentation updated if necessary

## Implementation Notes

- Added `BoardLayout` type and support for `vertical` layout in `generateKanbanBoard`.
- Introduced `--layout` option for `backlog board view` command.
- Updated tests and documentation to cover the new layout option.
