---
id: BACK-98
title: Invert task order in Done column only
status: Done
assignee:
  - '@Cursor'
created_date: '2025-06-20'
updated_date: '2025-06-20'
labels:
  - ui
  - enhancement
dependencies: []
---

## Description

Currently all tasks are sorted in ascending order by ID. This task is to change the Done column to show tasks in descending order (most recently completed first) while keeping all other columns in ascending order.

## Acceptance Criteria

- [x] Done column shows tasks in descending order by ID
- [x] Other status columns remain in ascending order
- [x] Board view reflects the new ordering
- [x] Exported boards show the correct ordering

## Implementation Notes

- Modified `src/ui/board.ts` to change the sort order for the "Done" column to be descending.
- Applied the same logic to `src/board.ts` to ensure that exported boards also reflect the new sort order.
- Kept the ascending sort order for all other columns.
