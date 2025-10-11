---
id: task-287.02
title: 'Phase 2: Backlog & Jira Integration Layer'
status: To Do
assignee: []
created_date: '2025-10-11 05:03'
updated_date: '2025-10-11 07:45'
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
Implement wrappers for Backlog CLI operations (via subprocess) and MCP Atlassian client (via context7 MCP tools).

**Deliverables:**
- BacklogClient wrapper: list tasks, get task, update task via CLI
- JiraClient wrapper: search issues, get issue, update issue, transition via MCP
- Connection verification command (backlog-jira connect)
- Multiline argument handling for cross-platform compatibility
- CLI output parsers for --plain format
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Files have frontmatter with jira_key, jira_last_sync, etc.
- [ ] #2 Sync store has entries for imported issues

- [ ] #3 TypeScript compiles: bunx tsc --noEmit
- [ ] #4 Unit tests pass: bun test src/integrations/
- [ ] #5 backlog-jira connect successfully verifies both connections
- [ ] #6 Backlog wrapper can list and parse task details via --plain
- [ ] #7 Jira wrapper can search and get issues via MCP
- [ ] #8 Multiline descriptions round-trip correctly on Windows
<!-- AC:END -->
