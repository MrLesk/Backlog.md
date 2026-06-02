---
id: BACK-504
title: Fix kanban drag-and-drop column sort reset and cross-column drop positioning
status: Done
assignee: []
created_date: '2026-05-31 10:56'
updated_date: '2026-05-31 13:51'
labels:
  - web-ui
  - bug
dependencies: []
priority: medium
ordinal: 163400
actual_start: '2026-05-31 11:30'
actual_end: '2026-05-31 13:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When dragging a task in the kanban board, two interaction issues were found and fixed:

1. Column sort reset on drag start: When a column was manually sorted (e.g., by ID descending), starting a drag operation immediately cleared the sort via setColumnSort(null), causing the task list to visually reorder underneath the user's cursor. The dragged task appeared to jump to a different position.

2. Cross-column drop always appended to end: Each TaskColumn maintained its own local draggedTaskId state. When dragging across columns, the target column's draggedTaskId remained null, so onDragOver handlers on individual task cards early-returned without setting dropPosition. This forced the drop to always insert at the end of the target column, making it impossible to drop between existing tasks.

Fixes applied:
- Removed setColumnSort(null) from onDragStart so the visual order is preserved during drag.
- Changed handleDrop to compute orderedTaskIds from getDisplayTasks() (visual order) instead of tasks prop (default order).
- Lifted draggedTaskId state from TaskColumn to Board component and passed it down via prop, so all columns know which task is being dragged.
- After cross-column drop, clear the target column's manual sort so the default ordinal-based ordering takes effect with the new task at the correct position.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dragging a task no longer clears the source column's manual sort; the visual order stays stable during drag.
- [x] #2 Dropping a task into the middle of a target column (cross-column) inserts it at the correct visual position, not just appended to the end.
- [x] #3 The draggedTaskId is shared across all columns via Board-level state, so every column can render drop indicators correctly.
- [x] #4 After cross-column drop, the target column reverts to default ordinal-based sorting while keeping the new task at the dropped position.
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
**Files modified:**
- `src/web/components/TaskColumn.tsx` — Removed local `draggedTaskId` state (now received via prop). Removed `setColumnSort(null)` from `onDragStart`. Changed `handleDrop` to build `orderedTaskIds` from `getDisplayTasks()` (visual order) instead of the `tasks` prop (default order). Added `taskId` to `onDragStart` callback signature. Clear `columnSort` on cross-column drop so ordinal-based ordering takes effect.
- `src/web/components/Board.tsx` — Added `draggedTaskId` state. Wired it through to every `TaskColumn` instance. Updated `onDragStart`/`onDragEnd` callbacks to set/clear `draggedTaskId` alongside existing `dragSourceStatus`/`dragSourceLane`.

**Key decisions:**
- `draggedTaskId` was lifted to Board because each `TaskColumn` previously owned its own local copy, leaving target columns unaware that a drag was in progress. This caused `onDragOver` to early-return and prevented `dropPosition` from being set.
- Using `getDisplayTasks()` in `handleDrop` ensures the drop index maps directly to the user's visual ordering, even when a column sort (e.g., ID descending) is active.
- Cross-column drops clear the target column's `columnSort` so the default `ordinal`/`createdDate` sort displays the new task in the correct position (its ordinal was already set server-side based on the visual drop index).

**Additional cleanup (pre-existing lint/format issues from earlier tasks):**
- `src/web/utils/date-display.ts` — Removed `match[N]!` non-null assertions by destructuring the RegExp match array.
- `src/web/utils/date-display.test.ts` — Replaced `timePart!`, `hours!`, `minutes!` with explicit guard checks.
- `src/web/utils/paste-as-markdown.ts` — Replaced 4 array non-null assertions (`current[last]!`, `cluster[0]!`) with null guards (`if (!x) continue`).
- `src/core/assets.ts` — Removed 3 `match[N]!` non-null assertions (match already validated non-null).
- `src/file-system/operations.ts` — Replaced `catch (err: any)` with `catch (err)` + `err instanceof Error`.
- CRLF → LF line endings fixed across 13 files: `package.json`, `src/core/statistics.ts`, `src/file-system/operations.ts`, `src/server/index.ts`, `src/skills/embedded/llm-wiki-for-backlog.ts`, `src/test/filesystem.test.ts`, `src/test/statistics.test.ts`, `src/types/index.ts`, `src/utils/date-utc.ts`, `src/web/hooks/useI18n.ts`, `src/web/lib/api.ts`, `src/web/locales/*` (en/ja/zh-CN/zh-TW), `src/web/utils/labelColors.ts`.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched (0 errors, 0 warnings after fixing pre-existing issues)
- [x] #3 bun test (or scoped test) passes — `web-task-column-sort`, `web-board-filters`, `reorder-utils` all pass
<!-- DOD:END -->
