---
id: task-287.04
title: 'Phase 4: Push, Pull & Sync Commands'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
updated_date: '2025-10-11 07:46'
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
Implement one-way (push/pull) and bidirectional (sync) operations with 3-way merge and conflict resolution.

**Deliverables:**
- Push command (Backlog → Jira) with field updates and transitions
- Pull command (Jira → Backlog) via CLI edits only
- 3-way merge algorithm with field-level conflict detection
- Conflict resolution strategies: prefer-backlog, prefer-jira, prompt
- Snapshot management for base states
- Interactive conflict resolution UI
- Acceptance criteria sync in both directions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unit tests pass: bun test src/commands/
- [ ] #2 3-way merge handles all conflict scenarios correctly
- [ ] #3 CLI invocations preserve multiline content
- [ ] #4 backlog-jira push updates Jira with Backlog changes
- [ ] #5 backlog-jira pull updates Backlog via CLI only (no direct writes)
- [ ] #6 backlog-jira sync --strategy prefer-backlog resolves conflicts
- [ ] #7 Concurrent edits trigger conflict detection and resolution
- [ ] #8 Acceptance criteria sync properly in both directions
<!-- AC:END -->
