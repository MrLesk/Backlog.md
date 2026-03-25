---
id: BACK-327
title: Fix loadTaskById to search remote branches
status: Done
assignee: []
created_date: '2025-11-30 20:46'
updated_date: '2025-11-30 20:46'
labels:
  - bug
  - task-loading
  - cross-branch
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

When viewing a task with `task view <id>`, if the task exists in a remote branch (e.g., `origin/test`) but not in the local filesystem, it would show "Task not found" even though the task is visible in the board and web UI.

This was because `loadTaskById()` only checked the local filesystem via `fs.loadTask()`, while `loadBoardTasks()` properly loads from remote and local branches.

## Root Cause

The `loadTaskById` function in `src/core/backlog.ts` was only checking the local filesystem:

```typescript
async loadTaskById(taskId: string): Promise<Task | null> {
  const canonicalId = normalizeTaskId(taskId);
  return await this.fs.loadTask(canonicalId);
}
```

## Solution

Updated `loadTaskById` to search in order:
1. Local filesystem (current branch)
2. Other local branches (using `findTaskInLocalBranches`)
3. Remote branches (using `findTaskInRemoteBranches`)

Added two new helper functions to `task-loader.ts`:
- `findTaskInRemoteBranches()` - finds and hydrates a task from remote branches
- `findTaskInLocalBranches()` - finds and hydrates a task from other local branches

Both functions use the same optimized index-first, hydrate-later pattern as `loadRemoteTasks()`.

## Files Changed

- `src/core/task-loader.ts`: Added `findTaskInRemoteBranches()` and `findTaskInLocalBranches()`
- `src/core/backlog.ts`: Updated `loadTaskById()` to use branch search functions
- `src/test/find-task-in-branches.test.ts`: Added tests for new functions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tasks in remote branches are viewable via `task view <id>`
- [x] #2 Tasks in other local branches are viewable via `task view <id>`
- [x] #3 Respects remoteOperations config setting
- [x] #4 Uses activeBranchDays config for branch filtering
- [x] #5 Tests cover the new functions
<!-- AC:END -->
