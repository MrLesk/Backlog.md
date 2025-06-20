---
id: task-96
title: Fix demoted task board visibility - check status across archive and drafts
status: Done
assignee:
  - '@Cursor'
created_date: '2025-06-20'
updated_date: '2025-06-20'
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

- Updated `handleBoardView` in `src/cli.ts` to check for demoted or archived tasks across all local and remote branches.
- The new logic fetches all branches, then scans the `.backlog/drafts` and `.backlog/archive/tasks` directories in each branch.
- It collects the IDs of all demoted and archived tasks and uses them to filter the board view, ensuring that these tasks are not displayed.
- This approach avoids modifying the `loadRemoteTasks` function and its associated tests, which were causing issues in the previous implementation.
- All tests are passing with this new implementation.
