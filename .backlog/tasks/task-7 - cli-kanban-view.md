---
id: task-7
title: "Kanban Board: Implement CLI Text-Based Kanban Board View"
status: "To Do"
assignee: []
reporter: @MrLesk
created_date: 2025-06-04
labels: ["cli", "command"]
milestone: "M2 - CLI Kanban Board"
dependencies: ["task-3"]
---

## Description

Design and implement a CLI command (`backlog board view` or similar) that reads tasks from `.backlog/tasks/` and displays them in a simple text-based Kanban board format in the terminal. Columns should be derived from task statuses.

## Acceptance Criteria

- [ ] Command parses task files and groups them by status.
- [ ] Output is a readable text-based representation of the Kanban board.
- [ ] Columns are dynamically generated.
