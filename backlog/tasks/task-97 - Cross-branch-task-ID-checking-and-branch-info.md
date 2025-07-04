---
id: task-97
title: Cross-branch task ID checking and branch info
status: Done
assignee:
  - '@Cursor'
created_date: '2025-06-19'
updated_date: '2025-06-20'
labels: []
dependencies: []
---

## Description

Check last task ID across all branches when creating tasks. Display branch containing latest task version in board.

## Acceptance Criteria

- [x] `backlog task create` checks all local and remote branches for the highest task ID
- [x] New tasks use an ID greater than any found across branches
- [x] `backlog board` displays which branch has the latest version of each task

## Implementation Plan

1. Fetch and scan `.backlog/tasks` across all branches to determine the max ID
2. Integrate branch detection into task creation logic
3. Update board rendering to show the branch that last modified each task

## Implementation Notes

- Added `listAllBranches` and `getFileLastModifiedBranch` to `src/git/operations.ts` to handle git interactions across all branches.
- Modified `generateNextId` in `src/cli.ts` to use `listAllBranches` and `listFilesInTree` to find the max task ID across all local and remote branches.
- Added `branch` property to the `Task` type in `src/types/index.ts`.
- Moved `listTasksWithMetadata` from `src/file-system/operations.ts` to `src/core/backlog.ts` and enhanced it to include the branch name using `getFileLastModifiedBranch`.
- Updated `handleBoardView` in `src/cli.ts` to call the new `core.listTasksWithMetadata` method.
- Modified `renderBoardTui` in `src/ui/board.ts` to display the branch name in the task list on the board.
- Corrected a bug in `src/cli.ts` related to handling of repeatable options in `commander`.
