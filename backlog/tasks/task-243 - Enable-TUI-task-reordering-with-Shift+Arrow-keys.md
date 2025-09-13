---
id: task-243
title: Enable TUI task reordering with Shift+Arrow keys
status: In Progress
assignee:
  - '@codex'
created_date: '2025-08-24 18:55'
updated_date: '2025-09-13 19:30'
labels:
  - tui
  - ui
  - enhancement
dependencies: []
---

## Description

The TUI task list should support reordering tasks using the same core move functionality available in the web interface. Users can hold Shift to enter move mode and then press the Up/Down arrow keys to reposition the selected task, similar to moving lines in an IDE.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task list view can reorder tasks by calling the existing core reorder function
- [ ] #2 Holding Shift toggles move mode and indicates the mode in the UI
- [ ] #3 Up and Down arrow keys move the selected task while in move mode
- [ ] #4 Task order persists after moving and remains consistent across interfaces
<!-- AC:END -->
