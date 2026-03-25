---
id: BACK-79
title: Fix task list ordering - sort by decimal ID not string
status: Done
assignee:
  - '@AI'
created_date: '2025-06-17'
updated_date: '2025-06-17'
labels:
  - bug
  - regression
dependencies: []
---

## Description

There is a regression in the task list view where tasks are being sorted alphabetically by their string IDs instead of numerically by their decimal task IDs. This causes incorrect ordering where task-10 appears before task-2.

### Current Behavior
Tasks are ordered like: task-1, task-10, task-11, task-2, task-20, task-3...

### Expected Behavior
Tasks should be ordered numerically: task-1, task-2, task-3, task-10, task-11, task-20...

## Acceptance Criteria

- [x] Task list view sorts tasks by numeric ID value, not string comparison
- [x] Decimal subtasks (e.g., task-4.1, task-4.2) are ordered correctly within their parent task group
- [x] Sorting works correctly for both single-digit and multi-digit task IDs
- [x] Add tests to verify numeric sorting behavior
- [x] No performance regression in task list rendering

## Implementation Notes

The task list ordering issue was caused by using string comparison (`localeCompare`) for task IDs in the `FileSystem.listTasks()` method. This resulted in incorrect ordering where task-10 appeared before task-2.

### Solution
- Created a new utility module `src/utils/task-sorting.ts` with functions for numeric task ID comparison
- `parseTaskId()` - Extracts numeric components from task IDs (handles both simple and decimal IDs)
- `compareTaskIds()` - Compares two task IDs numerically
- `sortByTaskId()` - Sorts an array of tasks by ID without mutating the original array

### Changes Made
1. Updated `src/file-system/operations.ts` to use `sortByTaskId()` instead of `localeCompare`
2. Applied the fix to both `listTasks()` and `listDecisionLogs()` for consistency
3. The board view already had proper numeric sorting via the `compareIds` function

### Testing
- Added comprehensive unit tests for the sorting utilities
- Added integration tests to verify filesystem operations sort correctly
- All existing tests continue to pass
- Manual verification shows tasks now appear in correct numeric order

### Trade-offs
- Slightly more complex than string comparison but necessary for correct behavior
- No performance impact as the sorting algorithm is still O(n log n)
- The solution is reusable across the codebase for consistent sorting
