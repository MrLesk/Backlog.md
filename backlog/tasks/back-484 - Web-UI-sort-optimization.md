---
id: BACK-484
title: 'Web UI sort optimization'
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-23 10:50'
updated_date: '2026-05-23 11:15'
labels:
  - web-ui
  - ui
  - ux
dependencies: []
priority: low
ordinal: 33100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unify and polish sort indicators across the Web UI for a consistent look and feel.

1. **Task List page (`/tasks`)** — Replaced the plain-text sort glyphs (`↕` `▲` `▼`) with a modern split-arrow design: left arrow for ascending, right arrow for descending. Inactive arrows are dimmed; the active direction lights up while the other stays muted. All three states share an identical outer frame so column headers never jitter when switching sort direction.

2. **Milestones page (`/milestones`)** — Added sortable table headers inside every milestone group (including "Unassigned Tasks" and individual milestones). Each group maintains its own independent sort state so sorting within one milestone does not affect others. Header columns: ID, Title, Status, Priority. Uses the same split-arrow icon design as the Task List.

3. **Board page (`/board`)** — Expanded the column-actions menu to 6 local sort actions (ID ↑/↓, Title ↑/↓, Priority ↑/↓) plus the original "Apply Priority Order" save action at the bottom. Local sorts only affect display order; active sort is highlighted in the menu with an X to clear. Dragging a task or applying priority order clears the local sort and restores ordinal-based ordering. Dropdown width is dynamic to prevent text wrapping.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task List sort icons use split-arrow glyphs (`↑` left, `↓` right) inside a fixed-width container
- [x] #2 Task List inactive state shows both arrows dimmed; active state highlights the matching arrow while keeping the opposite arrow dimmed
- [x] #3 Task List sort icon frame size is identical across all three states (asc, desc, inactive) to prevent layout shift
- [x] #4 Milestones page displays sortable column headers (ID / Title / Status / Priority) inside every milestone group
- [x] #5 Each milestone group maintains independent sort state (column + direction) that does not affect other groups
- [x] #6 Milestones sort icons use the same split-arrow design as Task List
- [x] #7 Board column-actions menu provides 6 sort options (ID / Title / Priority × asc / desc)
- [x] #8 Board sort actions use the same split-arrow icon style as TaskList/Milestones
- [x] #9 All changes pass type-checking and linting
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Task List sort icons**
   - Replace `renderSortIcon` in `TaskList.tsx` with split-arrow glyphs (`↑` left / `↓` right) inside a fixed `w-4` frame.
   - Inactive: both dimmed. Active: matching arrow lit, opposite dimmed.

2. **Milestones sortable headers**
   - Add `bucketSorts` state (`Record<string, BucketSortConfig>`) keyed by `bucket.key`.
   - `__unassigned` gets its own entry for independent sort.
   - Extract `renderBucketTableHeader(bucketKey)` reused by milestone cards and unassigned section.
   - Replace `getSortedTasks()` with version accepting `(tasks, bucketKey)` supporting `id | title | status | priority`.
   - Align `MilestoneTaskRow` grid columns with header grid.

3. **Board column-actions menu**
   - Add 6 local sort options (ID / Title / Priority × asc / desc) to `TaskColumn.tsx`.
   - Local sorts only affect display order via `columnSort` state; cleared on drag or when "Apply Priority Order" is invoked.
   - Active sort highlighted in menu with an X button to clear.
   - Rename original menu item to "Apply Priority Order" / "按优先级重排（保存）".
   - Make dropdown width dynamic (`min-w-[12rem] w-max`) with `whitespace-nowrap`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- **Task List** (`src/web/components/TaskList.tsx`): `renderSortIcon` now renders a fixed `w-4` container with two arrows (`↑` `↓`). Inactive = both dimmed; asc = left lit; desc = right lit. Prevents layout shift when switching directions.

- **Milestones** (`src/web/components/MilestonesPage.tsx`):
  - `bucketSorts` state (`Record<string, BucketSortConfig>`) stores per-bucket sort config keyed by `bucket.key`; `__unassigned` uses `"__unassigned"`.
  - `renderBucketTableHeader(bucketKey)` renders a clickable header row (ID / Title / Status / Priority) with the same split-arrow icon style.
  - `getSortedTasks(tasks, bucketKey)` applies column+direction sort; falls back to `compareTaskIds` for tie-breaking.
  - Previous "done-to-bottom" behavior removed — user-selected sort has full control.

- **MilestoneTaskRow** (`src/web/components/MilestoneTaskRow.tsx`): Grid updated to `grid-cols-[1.5rem_6rem_1fr_6rem_5rem]` matching the header layout.

- **Board** (`src/web/components/TaskColumn.tsx`):
  - 6 local sort options (ID / Title / Priority × asc / desc) stored in `columnSort` state; only affects display order.
  - Active option highlighted in dropdown menu; X button on the active row clears `columnSort`.
  - Dragging a task or clicking "Apply Priority Order" clears `columnSort` and restores ordinal-based display.
  - "Apply Priority Order" renamed from "Sort by Priority" to disambiguate from view-only sorting; uses `SortAscendingIcon` (list + up arrow) to indicate persistence.
  - Dropdown changed from fixed `w-48` to `min-w-[12rem] w-max` with `whitespace-nowrap`.

- All changes pass `bunx tsc --noEmit` and `bun run check .`.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
