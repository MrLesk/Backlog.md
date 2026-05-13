---
id: BACK-493.4
title: 'Web UI Kanban Board: group and indent subtasks under parent, with collapse'
status: To Do
assignee: []
created_date: '2026-05-13 10:50'
labels:
  - web-ui
  - subtasks
  - frontend
dependencies:
  - BACK-493.1
  - BACK-493.3
references:
  - src/web/components/Board.tsx
  - src/web/components/TaskCard.tsx
  - src/types/index.ts
modified_files:
  - src/web/components/TaskColumn.tsx
parent_task_id: BACK-493
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The kanban board (`src/web/components/Board.tsx` + `TaskColumn.tsx`) renders all tasks as a flat list within each status column. After BACK-493.01 ships, tasks include `parentTaskId` and `subtaskSummaries`. This task groups subtasks visually below their parent within each column.

**Grouping logic (implement in `TaskColumn` or as a helper):**

Given the tasks for a column, produce a sorted render order:
1. For each task without `parentTaskId` (a "root" task), render it normally.
2. If the root task has `subtaskSummaries`, render its subtasks immediately after it, in ID order.
3. Subtasks that appear in the column but whose parent is NOT in the same column are rendered normally (no special indentation) — do not break orphan subtasks.

**Visual design:**

- Subtask cards rendered in the grouped position get `pl-4` left padding and a left border accent (`border-l-2 border-purple-300 dark:border-purple-600`) on their wrapper `div`
- Parent cards with subtasks in this column show a small `▾ N subtask(s)` toggle button below their card body (or as a footer row), where N is the count of subtasks *in this column*
- Clicking the toggle collapses/expands the subtask group; state is per parent-card per column (local React state, `Record<string, boolean>`)
- Collapsed parents show `▸ N subtask(s)` (arrow changes direction)

**Where to make changes:**

- `src/web/components/TaskColumn.tsx` (or wherever per-column task rendering lives — find it via the `TaskColumn` import in `Board.tsx`) is the right place for the grouping and collapse state
- `Board.tsx` itself passes tasks to columns; no change needed there unless the grouping helper is extracted to a shared util

**Interaction with BACK-493.03:** The subtask badge added in .03 remains on the card; the indentation in this task provides the additional spatial grouping cue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Subtasks appear immediately below their parent card in the same kanban column
- [ ] #2 Subtask cards are visually indented with a left border accent
- [ ] #3 Parent cards with in-column subtasks show a collapse toggle with the subtask count
- [ ] #4 Collapsing a parent hides all its subtask cards in that column
- [ ] #5 Subtasks whose parent is not in the same column render as normal (non-indented) cards
- [ ] #6 Orphan subtasks (parent missing from board entirely) render as normal cards
- [ ] #7 No TypeScript errors, bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
