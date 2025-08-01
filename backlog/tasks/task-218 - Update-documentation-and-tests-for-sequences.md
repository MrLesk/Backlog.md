---
id: task-218
title: Update documentation and tests for sequences
status: To Do
assignee: []
created_date: '2025-07-27'
labels:
  - sequences
  - documentation
  - testing
dependencies:
  - task-213
  - task-214
  - task-215
  - task-216
  - task-217
---

## Description

Ensure users and developers understand how sequences work across all interfaces and that the new feature is covered by tests and documentation.

## Acceptance Criteria

- [ ] Update Backlog.md documentation (e.g., in backlog/docs/) to explain the concept of sequences, how they are automatically computed from dependencies, and how to view/manipulate them via CLI, TUI and the web UI.
- [ ] Update CLI help text to include the new sequence command and its options (including --plain).
- [ ] Document the new API endpoints and how the web UI uses them.
- [ ] Add integration tests covering end-to-end flows: computing sequences, listing via CLI, viewing in TUI, fetching via API and interacting with the web UI.
- [ ] Ensure that acceptance criteria across all tasks have corresponding tests and that all docs reflect the current behaviour.
