---
id: BACK-355.04
title: 'Filtering: Add type-based filtering to task list and search'
status: To Do
assignee: []
created_date: '2026-01-01 23:37'
labels:
  - core
  - cli
  - mcp
dependencies:
  - task-355.01
parent_task_id: task-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable filtering tasks by type in list views, search, and board views. This supports workflows where users want to see only bugs or only features.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TaskListFilter interface includes optional 'type' field
- [ ] #2 CLI task list accepts --type filter flag
- [ ] #3 MCP task_list tool accepts type filter parameter
- [ ] #4 Search filters support type field
- [ ] #5 Multiple types can be specified for OR filtering (e.g., --type bug,feature)
- [ ] #6 Filter tests cover type filtering scenarios
<!-- AC:END -->
