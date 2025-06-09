---
id: task-25
title: 'CLI: Export Kanban board to README'
status: Done
assignee: []
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels: []
dependencies: []
---

## Description

Implement new command backlog board export to append the board to README.md or specified output file.

## Acceptance Criteria

- [x] `backlog board export` writes the kanban board to `readme.md` if it exists.
- [x] Provide `--output <path>` option to save board to another file.
- [x] Automatically create the file if the specified path does not exist.
- [x] Appended content preserves existing file contents and adds the board at the end.

## Implementation Notes

- Added `exportKanbanBoardToFile()` in `src/board.ts` to handle writing the board to a file.
- New `board export` command in `src/cli.ts` gathers tasks (including remote) and uses this helper.
- Supports `--output` option and defaults to `readme.md`.
- Ensures output file exists and appends the board while preserving content.
