---
id: task-7
title: "Kanban Board: Implement CLI Text-Based Kanban Board View"
status: Done
assignee: []
reporter: "@MrLesk"
created_date: 2025-06-04
updated_date: 2025-06-09
completed_date: 2025-06-09
labels: ["cli", "command"]
milestone: "M2 - CLI Kanban Board"
dependencies: ["task-3"]
---

## Description

Design and implement a CLI command (`backlog board view` or similar) that reads tasks from `.backlog/tasks/` and displays them in a simple text-based Kanban board format in the terminal. Columns should be derived from task statuses.

## Acceptance Criteria

- [x] Command parses task files and groups them by status.
- [x] Output is a readable text-based representation of the Kanban board.
- [x] Columns are dynamically generated.

## Implementation Notes

Implemented `generateKanbanBoard()` in `src/board.ts` to build a text table of
tasks grouped by status. Added a new `board view` command in `src/cli.ts` that
loads tasks, uses project status order from `config.yml`, and prints the board
to the terminal. The function is exported via `src/index.ts` and covered by unit
tests in `src/test/board.test.ts`. Updated `readme.md` with usage instructions.
