---
id: task-4.2
title: "CLI: Task Listing and Viewing"
status: Done
assignee: @MrLesk
reporter: @MrLesk
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: m-1
dependencies: ["task-4.1"]
parent_task_id: task-4
---

## Description

Add commands to browse tasks:

- `backlog task list` / `backlog tasks list` to show tasks.
- `backlog task view <task-id>` or `backlog task <task-id>` to show a specific task.

## Acceptance Criteria

- [x] Listing shows tasks grouped by status.
- [x] Viewing displays task details with Markdown formatting.
- [x] Commands do not modify task files.
