---
id: task-217
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
---

## Description

Ensure users and developers understand how sequences work across all interfaces and that the new feature is covered by tests and documentation.

## Acceptance Criteria

- [ ] Update Backlog.md documentation (e.g., in backlog/docs/) to explain the concept of sequences, how they are automatically computed from dependencies, and how to view/manipulate them via CLI, TUI and the web UI.
- [ ] Update main README.md to document sequences feature and how it enables parallel task execution within each sequence.
- [ ] Update agent instructions (src/guidelines/agent-guidelines.md) to explain that agents can work on all tasks within a sequence in parallel, as they have no dependencies on each other.
- [ ] Update CLI help text to include the new sequence command and its options (including --plain).
- [ ] Ensure that acceptance criteria across all tasks have corresponding tests and that all docs reflect the current behaviour.

