---
id: task-217
title: Create web UI for sequences with drag-and-drop
status: To Do
assignee: []
created_date: '2025-07-27'
labels:
  - sequences
  - web-ui
  - frontend
dependencies:
  - task-213
  - task-216
---

## Description

Provide a user-friendly page where sequences are displayed and tasks can be moved between them. This interface will live above the Kanban board and allow dynamic reordering of tasks while keeping dependencies in sync.

## Acceptance Criteria

 - [ ] Add a "Planning" menu item between the Kanban Board and All Tasks that navigates to a dedicated sequences page.
- [ ] On the sequences page, fetch sequences via the API from Task 216 and display them vertically; each sequence clearly labeled.
- [ ] Implement drag-and-drop (e.g., using a library like react-beautiful-dnd) so users can move tasks within and between sequences.
- [ ] When a task is dropped into a new sequence, call the move endpoint to update dependencies accordingly and refresh the UI to reflect changes.
- [ ] Provide visual cues during drag (e.g., highlight drop targets) and handle error conditions gracefully (e.g., invalid drops).
- [ ] Add front-end tests ensuring sequences render correctly and drag-and-drop actions trigger the appropriate API calls and UI updates.

## Implementation Plan

1. Add new API helpers `fetchSequences` and `moveTaskToSequence` in `src/web/lib/api.ts`.
2. Create `SequencesPage` React component that loads sequences on mount and displays them vertically.
3. Implement HTML5 drag-and-drop to reorder tasks and call the move API on drop.
4. Register a new `/sequences` route in `App.tsx` and add a "Planning" navigation link in `SideNavigation` above All Tasks.
5. Write unit tests for the API helpers and a basic render test for the new page using Happy DOM and React Testing Library.
