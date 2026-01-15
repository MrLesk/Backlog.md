---
id: BACK-363
title: Fix localById case mismatch in cross-branch task loading
status: To Do
assignee: []
created_date: '2026-01-15 20:30'
updated_date: '2026-01-15 20:49'
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
- [ ] #1 localById map in loadRemoteTasks uses lowercase keys (t.id.toLowerCase())
- [ ] #2 localById map in loadLocalBranchTasks uses lowercase keys
- [ ] #3 Cross-branch loading correctly identifies existing local tasks with custom prefixes (e.g., JIRA)
- [ ] #4 No unnecessary hydration occurs when local task already exists
- [ ] #5 Conflict resolution works correctly (local tasks not overridden incorrectly)
- [ ] #6 Tests cover custom prefix scenarios for cross-branch loading
- [ ] #7 TaskDetailsModal displayId uses normalizeTaskId or removes hardcoded TASK- prefix
<!-- AC:END -->
