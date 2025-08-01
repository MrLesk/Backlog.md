---
id: task-216
title: Add server API endpoints and web UI for sequences
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-07-27'
labels:
  - sequences
  - api
  - backend
  - web-ui
  - frontend
dependencies:
  - task-213
---

## Description

Expose sequences to the web UI and support updates when tasks are moved between sequences. Provide a user-friendly web interface where sequences are displayed and tasks can be moved between them with drag-and-drop functionality. The server and client are both served by Bun's fullstack functionality running locally on localhost. The server endpoints act as a bridge between the web UI and the core sequence functions from Task 213, without duplicating logic.

## Acceptance Criteria

- [ ] Implement a GET /sequences endpoint that calls the core computeSequences function from Task 213 and returns the computed sequences as JSON (sequence number and list of task IDs/titles).
- [ ] Implement a POST /sequences/move endpoint that accepts a task ID, target sequence index, and a flag indicating if this creates a new sequence, then uses core functions to update task dependencies accordingly.
- [ ] Validate input and return appropriate error responses on invalid requests.
- [ ] Ensure that updating dependencies via the move endpoint persists changes to the markdown task files using existing file-system operations.
- [ ] Add unit tests verifying that the endpoints return correct data and update dependencies as expected.
- [ ] Add a "Sequences" menu item between Kanban Board and All Tasks that navigates to a dedicated sequences page.
- [ ] On the sequences page, fetch sequences via the API and display them vertically; each sequence clearly labeled.
- [ ] Implement drag-and-drop (e.g., using a library like @dnd-kit/sortable) so users can move tasks within and between sequences.
- [ ] Show drop zones between sequences as soon as a task drag starts (when lifted), allowing users to create new sequences by dropping tasks between existing sequences or at the top/bottom.
- [ ] When a task is dropped (into existing sequence or drop zone), call the move endpoint to set the moved task's dependencies to all tasks from the previous sequence, and update all tasks in the immediately next sequence to depend on the moved task.
- [ ] Provide visual cues during drag (e.g., highlight drop targets, show drop zones) and handle error conditions gracefully (e.g., invalid drops).
- [ ] Add front-end tests ensuring sequences render correctly and drag-and-drop actions trigger the appropriate API calls and UI updates.
