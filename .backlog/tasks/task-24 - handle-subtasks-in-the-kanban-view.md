---
id: task-24
title: Handle subtasks in the Kanban view
status: Done
assignee: []
created_date: '2025-06-09'
updated_date: '2025-06-09'
completed_date: '2025-06-09'
labels: []
dependencies: []
---

## Description

Display subtasks indented with pipes | and em dashes — under their parent task. Subtask IDs show the pipe prefix while titles are cleanly spaced.

## Acceptance Criteria

- [x] Subtasks appear under their parent task in the Kanban board
- [x] Pipes and em dashes visually indent subtasks for clarity
- [x] Subtask IDs prefixed with `  |—` (2 spaces + pipe + em dash)
- [x] Subtask titles indented with 2 spaces (no pipes for clean appearance)

## Implementation Notes

* Updated `generateKanbanBoard()` in `src/board.ts` to group subtasks under
  their parent when both share the same status.
* Subtasks use enhanced formatting: IDs prefixed with `  |—` (2 spaces + pipe + em dash), 
  titles indented with 2 spaces only for clean appearance.
* Added new unit test `nests subtasks under their parent when statuses match`
  in `src/test/board.test.ts`.
* Successfully integrated subtask functionality with ID sorting (task 23), vertical layout (task 21), and export features (task 25).
* Enhanced sorting to use `compareIds` for both parent tasks and subtasks, ensuring proper numeric ordering.
* Subtask functionality works seamlessly across all board layouts (horizontal/vertical) and export operations.
* UI improvements: Increased indentation to 2 spaces and removed pipes from subtask titles per user feedback.
