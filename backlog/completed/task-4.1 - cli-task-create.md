---
id: task-4.1
title: "CLI: Task Creation Commands"
status: Done
assignee: @MrLesk
reporter: @MrLesk
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-3"]
parent_task_id: task-4
---

## Description

Implement commands for creating tasks, drafts, and subtasks:

- `backlog task create` to add active tasks.
- `backlog draft create` to create tasks in draft mode.
- `backlog task create --parent <task-id>` to create a subtask under an existing task.

## Acceptance Criteria

- [x] Commands create Markdown files in the correct directories.
- [x] Required metadata is captured from flags or prompts.
- [x] Subtasks are saved using decimal IDs under `.backlog/tasks/`.
- [x] Changes are committed with a descriptive message.
