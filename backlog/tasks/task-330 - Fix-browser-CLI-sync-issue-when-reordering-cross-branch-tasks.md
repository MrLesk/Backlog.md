---
id: task-330
title: Fix browser/CLI sync issue when reordering cross-branch tasks
status: Done
assignee: []
created_date: '2025-12-02 19:53'
updated_date: '2025-12-02 19:54'
labels:
  - bug
  - browser
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser UI shows tasks from other local branches but fails with "Task not found" error when users try to reorder them. This happens because the reorder operation only looks at the current branch's filesystem.

Root cause: TASK-326 and TASK-327 added cross-branch task discovery, but the reorder logic wasn't updated to handle tasks that exist only on other branches.

Reported in: https://github.com/MrLesk/Backlog.md/issues/444
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Local tasks can be reordered normally in browser UI
- [x] #2 Cross-branch tasks are visible but cannot be reordered from wrong branch
- [x] #3 Clear error message when attempting to modify cross-branch tasks
- [x] #4 Existing tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Fix Summary

### Changes (3 files)

1. **`src/core/backlog.ts`** - Modified `reorderTask()`:
   - Changed from `this.fs.loadTask()` to `this.getTask()` to find tasks in the content store
   - Added validation to reject reordering tasks with `branch` property

2. **`src/server/index.ts`** - Fixed `refreshLocalBranchTasks()`:
   - Only inject tasks that don't exist locally
   - Added refresh call before `reorderTask`

3. **`src/types/index.ts`** - Added `"local-branch"` to `source` type union

### Error Message
```
Task X exists in branch "Y" and cannot be reordered from the current branch. Switch to that branch to modify it.
```
<!-- SECTION:NOTES:END -->
