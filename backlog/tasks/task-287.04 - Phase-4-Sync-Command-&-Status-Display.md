---
id: task-287.04
title: 'Phase 4: Sync Command & Status Display'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
labels:
  - jira
  - cli
  - sync
  - phase4
dependencies: []
parent_task_id: task-287
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement batch sync for all linked tasks with 'backlog jira sync' and status command to show sync state with 'backlog jira status'. Includes concurrency control and state tracking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes
- [ ] #2 Unit test for sync logic with mock issues passes
- [ ] #3 Import 3 issues and edit one locally, one remotely, one in both places
- [ ] #4 backlog jira status displays 3 rows with correct states
- [ ] #5 backlog jira sync --changed syncs only changed tasks
- [ ] #6 Conflicts are resolved and clean tasks updated
<!-- AC:END -->
