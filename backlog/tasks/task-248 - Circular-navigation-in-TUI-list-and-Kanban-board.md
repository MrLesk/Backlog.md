---
id: task-248
title: Circular navigation in TUI list and Kanban board
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-02 20:42'
updated_date: '2025-09-04 20:26'
labels:
  - ui
  - tui
  - kanban
dependencies: []
---

## Description

In the TUI task list, navigating up from the first item should wrap to the last item, and navigating down from the last item should wrap to the first. Apply the same circular up/down behavior within each column of the Kanban board.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI list: Up from first item selects the last item.
- [ ] #2 TUI list: Down from last item selects the first item.
- [ ] #3 TUI list: With a single item, up/down keeps the same selection (no errors).
- [ ] #4 TUI list: With zero items, navigation produces no errors or crashes.
- [ ] #5 Kanban board: Within a column, Up from the first item selects the last item in that column.
- [ ] #6 Kanban board: Within a column, Down from the last item selects the first item in that column.
- [ ] #7 Kanban board: Columns with a single item keep the selection stable on up/down (no errors).
- [ ] #8 Kanban board: Empty column navigation does not crash and leaves selection state consistent.
<!-- AC:END -->

## Implementation Plan

1. Add circular up/down in GenericList (wrap at ends)
2. Add circular up/down in Kanban columns (board.ts)
3. Handle single/empty edge cases without errors
4. Minimal tests for list/board selection wrap
