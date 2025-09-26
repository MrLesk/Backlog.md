---
id: task-265.57.05
title: Update notes/plan tools to return formatted markdown
status: To Do
assignee: []
created_date: '2025-09-26 16:07'
updated_date: '2025-09-26 16:08'
labels: []
dependencies:
  - task-265.57.08
parent_task_id: task-265.57
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update notes_set, notes_get, notes_append, notes_clear, plan_set, plan_get, plan_append, plan_clear to return formatted markdown and remove JSON wrapping from handleMcpSuccess/handleMcpError
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 notes_set, notes_get, notes_append, notes_clear return formatted markdown
- [x] #2 plan_set, plan_get, plan_append, plan_clear return formatted markdown
- [x] #3 Remove JSON wrapping from handleMcpSuccess/handleMcpError
- [x] #4 Show operation details in human-readable format
<!-- AC:END -->