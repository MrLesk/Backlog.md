---
id: task-320
title: Refactor and fix move mode implementation
status: Done
assignee:
  - '@claude'
created_date: '2025-11-26 21:47'
updated_date: '2025-11-28 15:38'
labels:
  - bug
  - tui
  - high-priority
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactored the move mode implementation from task 319 to fix bugs and improve architecture.

**Original Issues:**
1. Tasks disappeared when moving from Done to In Progress
2. Moving tasks between columns had index synchronization issues
3. Expensive `loadBoardTasks()` call after each move caused UI flicker

**Root Causes:**
1. The `reorderTask` function tried to handle completed tasks as anchors, adding unnecessary complexity
2. No-op moves were still triggering expensive operations
3. Index wasn't properly clamped when switching columns
4. The move state didn't track original position for proper cancel

**Key Fixes:**
1. Simplified `reorderTask()` to only handle active tasks (completed tasks are filtered at board level)
2. Added early exit for no-op moves
3. Proper index clamping when switching columns in move mode
4. Track original position in MoveOperation for cancel
5. Update local state after move instead of expensive reload
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduce the issue where tasks disappear from Done column when moving a task out of it
- [x] #2 Fix: Moving a task from "Done" to "In Progress" should update the task correctly and preserve other Done tasks visibility
- [x] #3 Fix: Moving a task from "To Do" to "Done" should work correctly without errors
- [x] #4 Ensure `completed/` folder is strictly for archiving and not accessed for active board operations
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Refactoring Complete

### Changes to `src/ui/board.ts`
1. **Extended MoveOperation type** to include `originalStatus` and `originalIndex` for proper cancel
2. **Added `getTargetColumnSize()` helper** to calculate column sizes for proper index clamping
3. **Fixed left/right key handlers** to clamp index when switching columns
4. **Improved `performTaskMove()`**:
   - Added early exit for no-op moves (same position)
   - Update local state after move instead of calling `loadBoardTasks()`
   - Better error handling that restores state on failure

### Changes to `src/core/backlog.ts`
1. **Simplified `reorderTask()`** to remove completed task handling complexity
2. Active tasks only - completed tasks are now filtered at the board level
3. Cleaner code with fewer edge cases

### Changes from task-320 branch (preserved)
1. `filterTasksByLatestState()` now only shows tasks in "task" directory (not completed)
2. Fixed git filename trimming in `getBranchLastModifiedMap()`
3. Ordinal sorting in Done column now respects custom ordinals
<!-- SECTION:NOTES:END -->
