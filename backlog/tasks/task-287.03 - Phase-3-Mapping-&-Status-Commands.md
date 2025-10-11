---
id: task-287.03
title: 'Phase 3: Mapping & Status Commands'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
updated_date: '2025-10-11 07:46'
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
Implement discovery and mapping of Backlog tasks to Jira issues, plus status reporting with sync state classification.

**Deliverables:**
- Auto-mapping logic with fuzzy title matching
- Interactive mapping UI with candidate suggestions
- Status command showing sync states (InSync, NeedsPush, NeedsPull, Conflict)
- Payload normalizers and hash computation for both sides
- Sync state classification algorithm
- JSON output support and grep filtering
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Interactive conflict resolution prompt works correctly

- [ ] #2 Unit tests pass: bun test src/commands/map.ts src/commands/status.ts
- [ ] #3 Auto-mapping accuracy > 80% on test dataset
- [ ] #4 backlog-jira map --auto discovers and maps title matches
- [ ] #5 backlog-jira map --interactive provides selection UI
- [ ] #6 backlog-jira status shows correct sync states
- [ ] #7 backlog-jira status --grep "Conflict" filters correctly
- [ ] #8 backlog-jira status --json produces valid JSON
<!-- AC:END -->
