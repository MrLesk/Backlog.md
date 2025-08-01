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

- [ ] Add a "Sequences" tab or menu item above the Kanban board that navigates to a dedicated sequences page.
- [ ] On the sequences page, fetch sequences via the API from Task 216 and display them vertically; each sequence clearly labeled.
- [ ] Implement drag-and-drop (e.g., using a library like react-beautiful-dnd) so users can move tasks within and between sequences.
- [ ] When a task is dropped into a new sequence, call the move endpoint to update dependencies accordingly and refresh the UI to reflect changes.
- [ ] Provide visual cues during drag (e.g., highlight drop targets) and handle error conditions gracefully (e.g., invalid drops).
- [ ] Add front-end tests ensuring sequences render correctly and drag-and-drop actions trigger the appropriate API calls and UI updates.
