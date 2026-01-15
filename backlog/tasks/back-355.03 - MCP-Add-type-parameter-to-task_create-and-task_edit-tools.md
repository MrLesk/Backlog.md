---
id: BACK-355.03
title: 'MCP: Add type parameter to task_create and task_edit tools'
status: To Do
assignee: []
created_date: '2026-01-01 23:37'
labels:
  - mcp
dependencies:
  - task-355.01
parent_task_id: task-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update MCP tool schemas to support the type field, enabling AI agents to categorize tasks during creation and modification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task_create tool schema includes optional 'type' parameter with enum validation
- [ ] #2 task_edit tool schema includes optional 'type' parameter
- [ ] #3 task_view output includes type field
- [ ] #4 task_list output includes type for each task
- [ ] #5 MCP tool descriptions document the type field and valid values
- [ ] #6 Integration tests verify type handling in MCP tools
<!-- AC:END -->
