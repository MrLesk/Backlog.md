---
id: task-4
title: 'CLI: Task Management Commands'
status: Done
assignee: []
reporter: '@MrLesk'
created_date: '2025-06-04'
updated_date: '2025-06-09'
completed_date: '2025-06-09'
labels:
  - cli
  - command
milestone: m-1
dependencies:
  - task-3
---

## Description

Implement comprehensive task management functionality including creation, listing, viewing, editing, and archiving of tasks and drafts. This encompasses all user-facing CLI commands for task lifecycle management.

## Implementation Notes

- Subtasks **task-4.1** through **task-4.13** introduced complete CLI support for task and draft management.
- Commands include `task create`, `task list`, `task view`, `task edit`, `task archive`, `task demote`, and draft variants.
- Tasks can be created as subtasks using the `--parent` option and moved between draft and active states.
- Metadata updates such as status and labels persist correctly through the `edit` command.
- Extensive tests and documentation were added in each subtask to ensure reliability.
