---
id: BACK-451
title: 'Fix: Guard cross-branch loading behind checkActiveBranches flag'
status: Done
assignee: []
created_date: '2026-04-28 04:57'
updated_date: '2026-04-28 04:59'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current implementation of loadTasks and loadTasksForKanban calls loadRemoteTasks and loadLocalBranchTasks regardless of the checkActiveBranches flag. While it conditionally sets branchStateEntries to undefined, the loading itself still occurs and stamps tasks with a .branch property, which triggers read-only behavior in the UI. We need to guard these calls behind the checkActiveBranches flag.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Setting check_active_branches: false in config skips loadRemoteTasks and loadLocalBranchTasks.
- [x] #2 Remote tasks do not appear as read-only when check_active_branches: false.
- [x] #3 Existing cross-branch behavior is unchanged when check_active_branches: true.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Guarded `loadRemoteTasks` and `loadLocalBranchTasks` calls behind `checkActiveBranches !== false` in both `loadTasks` and `loadTasksForKanban` methods in `src/core/backlog.ts`. This prevents tasks from other branches from being loaded (and stamped with a `.branch` property) when cross-branch scanning is disabled, ensuring they don't trigger read-only behavior in the UI. Added a verification test case in `src/test/board-loading.test.ts`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
