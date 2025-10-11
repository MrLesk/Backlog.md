---
id: task-287.01
title: 'Phase 1: Jira Sync Foundation & Configuration'
status: To Do
assignee: []
created_date: '2025-10-11 05:02'
labels:
  - jira
  - foundation
  - phase1
dependencies: []
parent_task_id: task-287
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up core infrastructure: configuration schema, MCP client wrapper, sync state database, and logging. This establishes the foundation for all Jira sync functionality.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TypeScript compiles without errors (bunx tsc --noEmit)
- [ ] #2 Config validation works with unit test for parsing jira config
- [ ] #3 Database initializes: SyncStore constructor creates tables
- [ ] #4 MCP client instantiates: Unit test verifies wrapper methods exist
- [ ] #5 jira section in backlog/config.yml loads correctly
- [ ] #6 SyncStore instance creates .backlog/jira-sync.db file
- [ ] #7 Logger redacts secrets when logging config
<!-- AC:END -->
