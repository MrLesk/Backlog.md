---
id: task-287.03
title: 'Phase 3: Pull & Push Commands'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
labels:
  - jira
  - cli
  - sync
  - phase3
dependencies: []
parent_task_id: task-287
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement 'backlog jira pull' to fetch remote changes and 'backlog jira push' to send local changes to Jira. Includes 3-way merge conflict detection and resolution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes
- [ ] #2 Unit tests for conflict detection logic pass
- [ ] #3 Mock MCP calls in integration tests
- [ ] #4 Import issue PROJ-123, edit locally, push updates Jira
- [ ] #5 Edit issue in Jira (different field), pull merges without conflict
- [ ] #6 Edit both locally and remotely (same field), pull detects conflict
- [ ] #7 Interactive conflict resolution prompt works correctly
<!-- AC:END -->
