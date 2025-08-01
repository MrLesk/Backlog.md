---
id: task-206
title: Order done column by updatedDate in board export
status: To Do
assignee: []
created_date: '2025-07-26'
labels:
  - board
  - export
  - sorting
dependencies: []
---

## Description

The backlog board export command should order tasks in the done column by updatedDate (newest first) and then by id as a secondary sort criterion. This ensures the most recently completed tasks appear at the top of the done column.

## Acceptance Criteria

- [ ] Done column tasks are sorted by updatedDate in descending order (newest first)
- [ ] When tasks have the same updatedDate they are sorted by id in descending order
- [ ] Other columns maintain their existing sort order
- [ ] Export functionality produces correctly ordered output
