---
id: task-287.02
title: 'Phase 2: CLI Setup & Import Command'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
labels:
  - jira
  - cli
  - import
  - phase2
dependencies: []
parent_task_id: task-287
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement 'backlog jira setup' for configuration wizard and 'backlog jira import' for importing issues from Jira via JQL queries. This allows users to onboard and bring in their Jira issues.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes
- [ ] #2 backlog jira setup --help shows options
- [ ] #3 JiraMappingService converts Jira issue to Task object (unit test)
- [ ] #4 backlog jira setup wizard completes successfully
- [ ] #5 backlog jira import --project PROJ --limit 5 creates 5 markdown files
- [ ] #6 Markdown files created in backlog/tasks/ with Jira keys as IDs
- [ ] #7 Files have frontmatter with jira_key, jira_last_sync, etc.
- [ ] #8 Sync store has entries for imported issues
<!-- AC:END -->
