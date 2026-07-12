---
id: BACK-363
title: Fix localById case mismatch in cross-branch task loading
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 20:30'
updated_date: '2026-01-15 21:07'
labels:
  - core
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-360 fixed the index to use lowercase IDs, but `loadRemoteTasks` and `loadLocalBranchTasks` still build `localById` maps using canonical uppercase IDs (`t.id`). This causes Map.get mismatches when custom prefixes are used.

When prefix is "JIRA":
- Index stores: `"jira-123"` (lowercase from BACK-360 fix)
- `localById` keys: `"JIRA-123"` (uppercase from `t.id`)
- `localById.get("jira-123")` returns `undefined`

This causes:
1. Every remote/local-branch task is treated as "missing" locally
2. All tasks get hydrated unnecessarily (extra git I/O)
3. Remote tasks may override local tasks during conflict resolution

Additionally, `src/web/components/TaskDetailsModal.tsx:277` has a hardcoded "TASK-" prefix normalization that doesn't work for custom prefixes:
```typescript
const displayId = useMemo(() => task?.id?.replace(/^task-/i, "TASK-") || "", [task?.id]);
```
This should either be removed (IDs are already normalized) or use `normalizeTaskId` utility.

Fix: Normalize `localById` keys to lowercase when building the map in `chooseWinners`, `loadRemoteTasks`, and `loadLocalBranchTasks`. Also fix or remove the hardcoded display ID normalization in TaskDetailsModal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 localById map in loadRemoteTasks uses lowercase keys (t.id.toLowerCase())
- [x] #2 localById map in loadLocalBranchTasks uses lowercase keys
- [x] #3 Cross-branch loading correctly identifies existing local tasks with custom prefixes (e.g., JIRA)
- [x] #4 No unnecessary hydration occurs when local task already exists
- [x] #5 Conflict resolution works correctly (local tasks not overridden incorrectly)
- [x] #6 Tests cover custom prefix scenarios for cross-branch loading
- [x] #7 TaskDetailsModal displayId uses normalizeTaskId or removes hardcoded TASK- prefix
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Root Cause
- `buildRemoteTaskIndex` and `buildLocalBranchTaskIndex` store IDs as lowercase (e.g., `jira-123`)
- `loadRemoteTasks` and `loadLocalBranchTasks` build `localById` maps using `t.id` which is canonical uppercase (e.g., `JIRA-123`)
- `chooseWinners` does `localById.get(id)` where `id` is lowercase from the index → returns `undefined`

### Changes

1. **src/core/task-loader.ts:525** - `loadRemoteTasks`:
   - Change `new Map(localTasks.map((t) => [t.id, t]))`
   - To: `new Map(localTasks.map((t) => [t.id.toLowerCase(), t]))`

2. **src/core/task-loader.ts:655** - `loadLocalBranchTasks`:
   - Change `new Map(localTasks.map((t) => [t.id, t]))`
   - To: `new Map(localTasks.map((t) => [t.id.toLowerCase(), t]))`

3. **src/web/components/TaskDetailsModal.tsx:277** - displayId:
   - Remove hardcoded `replace(/^task-/i, "TASK-")` 
   - IDs are already normalized by the API, so just use `task?.id` directly

4. **Tests** - Add test cases for custom prefixes in cross-branch loading:
   - Verify local task with uppercase ID matches lowercase index entry
   - Verify no unnecessary hydration when local task exists
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Changes Made

1. **src/core/task-loader.ts:525** - `loadRemoteTasks`:
   - Changed `localById` map to use lowercase keys: `t.id.toLowerCase()`
   - This ensures the map lookup matches the lowercase format used in the index

2. **src/core/task-loader.ts:655** - `loadLocalBranchTasks`:
   - Same fix applied: `localById` map now uses lowercase keys

3. **src/web/components/TaskDetailsModal.tsx:277**:
   - Removed hardcoded `replace(/^task-/i, "TASK-")` normalization
   - Task IDs are already normalized by the API, so just use `task?.id` directly

### Tests Added

Added two new tests in `src/test/local-branch-tasks.test.ts`:
- `should match local tasks with uppercase IDs to lowercase index keys (custom prefix)` - Verifies that local tasks with canonical uppercase IDs (JIRA-123) correctly match lowercase index entries (jira-123)
- `should hydrate tasks that do not exist locally with custom prefix` - Verifies new tasks are still discovered and hydrated correctly

### Verification
- TypeScript compilation: PASS
- All tests: PASS (exit code 0)
<!-- SECTION:NOTES:END -->
