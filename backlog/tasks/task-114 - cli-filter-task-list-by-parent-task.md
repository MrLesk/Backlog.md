---
id: task-114
title: 'cli: filter task list by parent task'
status: To Do
assignee: []
created_date: '2025-07-06'
updated_date: '2025-07-06'
labels: []
dependencies: []
---

## Description
Add a new feature to the `backlog task list` command that allows filtering tasks by their parent task ID using `--parent` or `-p` flags. It should display all tasks that have the specified task as their parent. Additionally, support a `--plain` flag to output the list in a plain, unformatted text.

## Acceptance Criteria

- [ ] Add `--parent <task-id>` flag to `backlog task list` command
- [ ] Add `-p <task-id>` flag to `backlog task list` command
- [ ] Filter and display only tasks that have the specified parent task ID
- [ ] Support `--plain` flag for unformatted output
- [ ] Show appropriate message when no child tasks are found
- [ ] Validate parent task ID exists before filtering
