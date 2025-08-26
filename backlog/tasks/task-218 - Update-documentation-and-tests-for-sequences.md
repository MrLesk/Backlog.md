---
id: task-218
title: Update documentation and tests for sequences
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-08-26 16:47'
labels:
  - sequences
  - documentation
  - testing
dependencies:
  - task-213
  - task-214
  - task-215
  - task-217
---

## Description

Ensure users and developers understand how sequences work across all interfaces and that the new feature is covered by tests and documentation.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Update Backlog.md documentation (e.g., in backlog/docs/) to explain the concept of sequences, how they are automatically computed from dependencies, and how to view/manipulate them via CLI, TUI and the web UI.
- [ ] #2 Update main README.md to document sequences feature and how it enables parallel task execution within each sequence.
- [ ] #3 Update agent instructions (src/guidelines/agent-guidelines.md) to explain that agents can work on all tasks within a sequence in parallel, as they have no dependencies on each other.
- [ ] #4 Update CLI help text to include the new sequence command and its options (including --plain).
- [ ] #5 Ensure that acceptance criteria across all tasks have corresponding tests and that all docs reflect the current behaviour.
- [ ] #6 Docs explain Unsequenced bucket (no deps/dependees/ordinal), join semantics for moves, and insert-between via drop zones (later task)
- [ ] #7 CLI/TUI docs: --plain prints Unsequenced first; TUI move mode uses join semantics; blocked moves to Unsequenced unless isolated
- [ ] #8 Web UI docs: endpoints shape ({ unsequenced, sequences }), join semantics, error handling; update examples/screenshots
<!-- AC:END -->
