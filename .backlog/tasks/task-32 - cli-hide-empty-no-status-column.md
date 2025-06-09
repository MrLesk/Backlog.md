---
id: task-32
title: "CLI: Hide empty 'No Status' column"
status: To Do
assignee: []
created_date: '2025-06-09'
labels:
  - cli
  - bug
dependencies: []
---

## Description

When viewing the kanban board with `backlog board view`, an empty **No Status** column is always displayed even if no tasks lack a status. The board should only include this column when there are tasks without a defined status.

## Acceptance Criteria

- [ ] The board does not render the **No Status** column when there are no tasks missing a status.
- [ ] Regression test verifies the column is hidden when unused.
- [ ] Task committed to the repository.
