---
id: task-32
title: 'CLI: Hide empty ''No Status'' column'
status: Done
assignee: []
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels:
  - cli
  - bug
dependencies: []
---

## Description

When viewing the kanban board with `backlog board view`, an empty **No Status** column is always displayed even if no tasks lack a status. The board should only include this column when there are tasks without a defined status.

## Acceptance Criteria

- [x] The board does not render the **No Status** column when there are no tasks missing a status.
- [x] Regression test verifies the column is hidden when unused.
- [x] Task committed to the repository.

## Implementation Notes

* The functionality was already implemented in `generateKanbanBoard()` in `src/board.ts:71-78`.
* The code filters out empty status groups using `(groups.get(s)?.length ?? 0) > 0` condition.
* This ensures only status columns with actual tasks are displayed in both horizontal and vertical layouts.
* Regression test `omits 'No Status' column when all tasks have status` exists in `src/test/board.test.ts:77-93`.
* The implementation works for both terminal and markdown export formats.
* All existing functionality is preserved while improving the UI by hiding unnecessary empty columns.
