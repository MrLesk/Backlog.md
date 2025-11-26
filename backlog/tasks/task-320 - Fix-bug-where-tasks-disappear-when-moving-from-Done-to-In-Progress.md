---
id: task-320
title: Fix bug where tasks disappear when moving from Done to In Progress
status: To Do
assignee:
  - '@claude'
created_date: '2025-11-26 21:47'
labels:
  - bug
  - tui
  - high-priority
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user reported a serious bug in the TUI (likely related to recent Task 319 changes).

**Symptoms:**
1. When moving a task from "Done" to "In Progress" using the move mode, other tasks in the "Done" column disappear from the view.
2. Moving a task from "To Do" to "Done" fails or is not possible.

**Context:**
- "Done" tasks older than 1 month are moved to the `completed/` folder for archiving.
- The board should only display active tasks (including active "Done" tasks) from the `tasks/` directory.
- The `completed/` folder should NOT be accessed for board operations.

**Hypothesis:**
The issue might be related to how the TUI updates its local state (`currentTasks` / `currentColumnsData`) after a move operation, or how `Core.reorderTask` handles the "Done" status when calculating ordinals/positions, potentially filtering out tasks incorrectly during the refresh.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reproduce the issue where tasks disappear from Done column when moving a task out of it
- [ ] #2 Fix: Moving a task from "Done" to "In Progress" should update the task correctly and preserve other Done tasks visibility
- [ ] #3 Fix: Moving a task from "To Do" to "Done" should work correctly without errors
- [ ] #4 Ensure `completed/` folder is strictly for archiving and not accessed for active board operations
<!-- AC:END -->
