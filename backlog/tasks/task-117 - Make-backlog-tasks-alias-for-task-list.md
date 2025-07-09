---
id: task-117
title: Make backlog tasks alias for task list
status: To Do
assignee: []
created_date: '2025-07-06'
updated_date: '2025-07-09'
labels: []
dependencies: []
---

## Description

Currently, `backlog tasks` is an alias for the `task` command. This should be changed to be an alias for `backlog task list` instead, providing a more intuitive shortcut for listing all tasks.

## Acceptance Criteria

- [ ] Change `backlog tasks` to be an alias for `backlog task list`
- [ ] Remove the current alias that makes `backlog tasks` point to `task`
- [ ] Ensure help text reflects the updated alias behavior
- [ ] Test that `backlog tasks` shows the task list with all filtering options available
- [ ] Verify backward compatibility - existing scripts using `backlog task` should still work

## Technical Notes

The CLI alias configuration needs to be updated in the CLI definition to redirect `tasks` to `task list` instead of just `task`.
