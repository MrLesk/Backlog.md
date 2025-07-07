---
id: task-163
title: 'Fix intermittent git failure in task edit'
status: To Do
assignee: []
created_date: '2025-07-07'
labels: [bug]
dependencies: []
parent_task: task-108
---

## Description

The `backlog task edit` command intermittently fails with a `git status` error, even when the task file is successfully modified. This is caused by an unsafe git commit operation that doesn't properly stage the file before committing. The fix is to ensure that only the specified file is staged and committed, preventing other repository changes from interfering with the operation.

## Acceptance Criteria

- [ ] The `backlog task edit` command should not fail intermittently.
- [ ] The `backlog task edit` command should only stage and commit the modified task file.
- [ ] The `backlog task edit` command should not commit any other staged or unstaged changes in the repository.
- [ ] The fix should be covered by tests.
