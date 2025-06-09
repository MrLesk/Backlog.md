---
id: task-4.3
title: "CLI: Task Editing"
status: Done
assignee: @MrLesk
reporter: @MrLesk
created_date: 2025-06-04
updated_date: 2025-06-08
labels: [cli, command]
milestone: "M1 - CLI"
dependencies: [task-4.2]
parent_task_id: task-4
---
## Description

Implement editing of existing tasks:

- `backlog task edit <task-id>`

## Acceptance Criteria

- [x] Updates to title, description, status, labels, and assignee are persisted.
- [x] The command respects YAML frontmatter formatting.
- [x] A commit records the changes to the task file.
