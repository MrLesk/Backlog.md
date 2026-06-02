---
id: BACK-496
title: Fix subtask grouping under parent task for ID sorting across all views
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-28 19:09'
updated_date: '2026-05-28 23:09'
labels: []
dependencies: []
ordinal: 154400
actual_start: '2026-05-28 19:09'
actual_end: '2026-05-28 19:26'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subtasks were not correctly grouped under their parent tasks when sorting by ID in the All Tasks, Milestones, and Gantt views. The Board view handled this correctly by using compareTaskIds (supporting decimal IDs like task-495.4), while other views used extractTaskNumericId which only matched trailing digits, causing subtasks to sort far away from their parents.

All four views (Board, All Tasks, Milestones, Gantt) now use groupSubtasksUnderParents to ensure subtasks appear immediately under their parent task, with internal subtask order following the overall sort direction (ascending/descending).
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Subtasks appear immediately under parent task when sorting by ID in Board view
- [x] #2 Subtasks appear immediately under parent task when sorting by ID in All Tasks view
- [x] #3 Subtasks appear immediately under parent task when sorting by ID in Milestones view
- [x] #4 Subtasks appear immediately under parent task when sorting by ID in Gantt view
- [x] #5 Subtask order within group follows overall sort direction (ascending/descending)
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add groupSubtasksUnderParents utility to src/utils/task-sorting.ts with direction support.\n2. Replace extractTaskNumericId with compareTaskIds in TaskList, MilestonesPage, and GanttView.\n3. Apply groupSubtasksUnderParents during ID sorting in Board (TaskColumn), All Tasks (TaskList), Milestones (MilestonesPage), and Gantt (GanttView).\n4. Add unit tests for groupSubtasksUnderParents including direction reversal scenarios.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
groupSubtasksUnderParents works by iterating the already-sorted array, collecting children by parent ID into a Map, then rebuilding the output with each parent followed by its children. The direction parameter reverses children after compareFn sort to match overall ascending/descending order.\n\nTaskColumn.tsx (Board view) required special attention because its ID sort is a local column-level toggle separate from the default ordinal/date sort. The grouping is only applied when the user explicitly selects ID sort from the column menu.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed ID sorting behavior across all views to consistently group subtasks under their parent tasks.

Root causes:
1. TaskList, MilestonesPage, and GanttView used extractTaskNumericId (only matched trailing digits), causing decimal IDs like task-495.4 to be treated as 4 and sorted far from parent task-495.
2. None of the views had subtask-to-parent grouping logic.

Changes:
1. Unified all four views to use compareTaskIds for proper decimal ID sorting.
2. Added groupSubtasksUnderParents utility in src/utils/task-sorting.ts with direction support.
3. Applied grouping to Board, All Tasks, Milestones, and Gantt views during ID sorting.
4. Subtasks now appear under their parent task with internal order following the overall sort direction.
5. Added unit tests covering groupSubtasksUnderParents behavior including direction reversal.
<!-- SECTION:FINAL_SUMMARY:END -->
