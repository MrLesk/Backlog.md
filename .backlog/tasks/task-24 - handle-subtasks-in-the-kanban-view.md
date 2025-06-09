---
id: task-24
title: Handle subtasks in the Kanban view
status: Done
assignee: []
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels: []
dependencies: []
---

## Description

Display subtasks indented with pipes | and em dashes — under their parent task


## Acceptance Criteria

- [x] Subtasks appear under their parent task in the Kanban board
- [x] Pipes and em dashes visually indent subtasks for clarity

## Implementation Notes

* Updated `generateKanbanBoard()` in `src/board.ts` to group subtasks under
  their parent when both share the same status.
* Subtasks are prefixed with `|—` in both ID and title rows for visual
  indentation.
* Added new unit test `nests subtasks under their parent when statuses match`
  in `src/test/board.test.ts`.
