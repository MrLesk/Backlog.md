---
id: BACK-493.5
title: 'Web UI TaskList overview: indent subtask rows under their parent'
status: To Do
assignee: []
created_date: '2026-05-13 10:50'
updated_date: '2026-05-17 20:27'
labels:
  - web-ui
  - subtasks
  - frontend
milestone: m-8
dependencies:
  - BACK-493.1
references:
  - src/types/index.ts
  - src/web/components/TaskDetailsModal.tsx
modified_files:
  - src/web/components/TaskList.tsx
parent_task_id: BACK-493
priority: low
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The "All Tasks" overview (`src/web/components/TaskList.tsx`) renders tasks as a flat table. After BACK-493.01 ships, tasks include `parentTaskId`. This task groups the table rows so subtasks appear indented immediately below their parent.

**Grouping logic:**

After applying all filters and sorting, produce the final render order:
1. Walk the sorted list; for each task without `parentTaskId`, emit it as a "root" row.
2. If a root task has subtasks in the current display list, emit those subtasks immediately after, in ID order.
3. Subtasks whose parent is not in the current display list are emitted in their natural sorted position (no special treatment — filters may hide the parent).

Use a stable helper: build a `Map<parentId, subtask[]>` from the current display list, then reconstruct the render list as described.

**Visual design for subtask rows:**

- The ID cell gets `pl-6` (or `pl-8`) indentation to visually nest the row
- The title cell prepends a small "↳" or "└" character in muted gray before the title text, or a subtle left border via a wrapper element
- No additional badge needed (the ID cell indentation already signals hierarchy)
- Parent rows with subtasks in the current list show a small badge `(N)` next to their title, where N is the count of visible subtasks

**Sorting interaction:**

When the user clicks a column header to sort, disable the grouping (render flat, no indentation) — sorted views intentionally break the parent→child grouping. Re-enable grouping when sort returns to the default (ID descending). This avoids confusing interleaving when e.g. sorted by status.

Alternatively (simpler): always show grouping when `sortColumn === "id"`, disable for all other sort columns.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In the default sort (ID descending), subtask rows appear immediately below their parent row
- [ ] #2 Subtask rows are indented in the ID column and show a '↳' prefix in the title column
- [ ] #3 Parent rows show a badge with the count of visible subtasks
- [ ] #4 When sorted by any column other than ID, grouping is disabled and all rows render flat
- [ ] #5 Subtasks whose parent is not in the filtered list render in their natural sort position without indentation
- [ ] #6 No TypeScript errors, bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
