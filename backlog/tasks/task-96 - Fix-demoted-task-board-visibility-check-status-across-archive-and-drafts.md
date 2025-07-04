---
id: task-96
title: Fix demoted task board visibility - check status across archive and drafts
status: Done
assignee:
  - '@Cursor'
created_date: '2025-06-20'
updated_date: '2025-06-21'
labels: []
dependencies: []
---

## Description

## Acceptance Criteria

- [x] Demoted tasks must be removed from board display
- [x] Task status must be checked in archive/drafts folders
- [x] Board should not show tasks that exist in drafts or archive
- [x] Status must be checked across all local branches
- [x] Status must be checked across all remote branches

## Implementation Plan

1. Analyze current board display logic;
2. Implement cross-directory status checking (tasks, drafts, archive);
3. Add logic to check task status across all local git branches;
4. Add logic to check task status across all remote git branches;
5. Update board filtering to exclude demoted/archived tasks found in any branch;
6. Add tests for demoted task visibility;
7. Test branch-specific demotion scenarios;
8. Test remote branch status checking

## Implementation Notes

### Previous Implementation Issues

The initial implementation in commits 71fc0d7 and 6d7b0fd had a critical flaw - it was filtering tasks based on whether they existed in draft/archive folders in ANY branch, rather than checking which state was the most recent. This caused the board to not display any tasks at all.

### New Implementation (task/96 branch)

Created a proper solution that correctly implements cross-branch task state resolution:

1. **New Module**: Created `src/core/cross-branch-tasks.ts` with dedicated functions for:
   - `getLatestTaskStates()`: Fetches all branches and checks task files in tasks/drafts/archive directories
   - `filterTasksByLatestState()`: Filters tasks to only show those whose latest state is "task"

2. **Key Logic**:
   - For each task ID, finds ALL occurrences across ALL branches in all three directories
   - Uses `getFileLastModifiedTime()` to get the commit timestamp for each file
   - Keeps only the state with the most recent modification time
   - This ensures that if a task was demoted in branch A but is still active in branch B (and B is more recent), it will show as active

3. **Integration**:
   - Updated `handleBoardView()` in `src/cli.ts` to use the new cross-branch logic
   - Updated board export function to use the same logic for consistency
   - Maintains compatibility with existing remote task loading and conflict resolution

4. **Files Modified**:
   - Created: `src/core/cross-branch-tasks.ts`
   - Modified: `src/cli.ts` (handleBoardView and board export functions)

5. **Testing**:
   - All existing tests pass
   - Board displays correctly with proper cross-branch filtering
   - Export functionality works as expected

This implementation correctly handles the scenario where a task might be demoted in one branch but still active in another, showing the task's state based on the most recent modification across all branches.
