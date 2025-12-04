---
id: task-334
title: Fix task numbering reset when all tasks archived
status: Done
assignee:
  - "@codex"
created_date: "2025-12-04 13:21"
labels:
  - bug
  - id-generation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Description

Task numbering resets to task-1 when all active tasks are archived, instead of continuing from the highest task number across all directories (active, archived, completed, drafts).

Root cause: The `generateNextId()` method in `src/core/backlog.ts` only scans active tasks, cross-branch tasks, and drafts. It does not scan archived tasks (`backlog/archive/tasks/`) or completed tasks (`backlog/completed/`), causing ID reuse when all active tasks are moved to these directories.

This creates a critical data integrity issue:

- Risk of ID collisions if archived tasks are restored
- Violates user expectation of monotonic task numbering
- Inconsistent with the existing cross-branch ID checking philosophy

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Task numbering continues sequentially even when all active tasks are archived
- [x] #2 Creating task after archiving task-1 through task-5 results in task-6, not task-1
- [x] #3 Both archived and completed tasks are considered when generating new task IDs
- [x] #4 Subtask numbering works correctly with archived parent tasks
- [x] #5 Zero-padded ID configuration is respected
- [x] #6 No ID collisions between new and archived/completed tasks
- [x] #7 All existing tests pass with no regression
<!-- AC:END -->

## Implementation Plan

1. Add `listArchivedTasks()` method to FileSystem class (mirrors `listCompletedTasks()`)
2. Update `generateNextId()` in Core to scan archived and completed directories
3. Add JSDoc documentation explaining the behavior
4. Create comprehensive tests covering critical scenarios
5. Verify no performance degradation (< 100ms impact)
6. Run full test suite to ensure no regression

## Implementation Notes

### Changes Made

1. **Added `listArchivedTasks()` method** (`src/file-system/operations.ts`):
   - Mirrors `listCompletedTasks()` implementation
   - Scans `backlog/archive/tasks/` directory
   - Returns sorted array of Task objects

2. **Updated `generateNextId()` method** (`src/core/backlog.ts`):
   - Added calls to `listArchivedTasks()` and `listCompletedTasks()`
   - Includes archived and completed task IDs in max ID calculation
   - Added comprehensive JSDoc explaining all directories scanned
   - Ensures IDs are never reused, even if all active tasks are archived

3. **Created comprehensive tests** (`src/test/id-generation.test.ts`):
   - Test: Continue numbering after all tasks archived
   - Test: Consider both archived and completed tasks
   - Test: Handle subtasks correctly with archived parents
   - Test: Work with zero-padded IDs

### Files Modified

- `src/file-system/operations.ts` - Added listArchivedTasks() method
- `src/core/backlog.ts` - Updated generateNextId() with JSDoc
- `src/test/id-generation.test.ts` - New test file with 4 test cases

### Impact

- Data Integrity: No more ID collisions
- User Experience: Predictable, monotonic task numbering
- Performance: Minimal impact (< 100ms for typical archives)
- Breaking Changes: None (fixes broken behavior)

### Testing

- All 4 new tests pass
- Existing test suite passes with no regression
- Manual verification confirms fix works as expected
<!-- SECTION:DESCRIPTION:END -->
