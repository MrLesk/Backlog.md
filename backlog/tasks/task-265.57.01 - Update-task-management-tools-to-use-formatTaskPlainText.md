---
id: task-265.57.01
title: Update task management tools to use formatTaskPlainText
status: Done
assignee: []
created_date: '2025-09-26 16:07'
updated_date: '2025-09-26 16:21'
labels: []
dependencies:
  - task-265.57.08
parent_task_id: task-265.57
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update task_create, task_update, task_view, task_list, task_archive, task_demote to return formatted markdown by importing and using formatTaskPlainText from ui/task-viewer.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task_create, task_update, task_view, task_list, task_archive, task_demote return formatted markdown
- [x] #2 Import and use formatTaskPlainText from ui/task-viewer.ts
- [x] #3 task_list matches CLI --plain list format
- [x] #4 All task operations show rich formatted output
<!-- AC:END -->
