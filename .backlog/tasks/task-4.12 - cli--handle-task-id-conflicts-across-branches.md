---
id: task-4.12
title: 'CLI: Handle task ID conflicts across branches'
status: Draft
assignee: []
created_date: '2025-06-09'
labels: []
dependencies: []
parent_task_id: task-4
---
## Description
Implement detection of the latest task ID across all remote branches when creating a new task. The CLI should fetch branch references and inspect task files, similar to the kanban board remote status check, to determine the highest available ID before assigning the next one.

## Acceptance Criteria
- [ ] `backlog task create` checks all remote branches for task files and chooses the next sequential ID.
- [ ] New tasks always use an ID higher than any found across branches to avoid conflicts.
