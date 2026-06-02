---
id: BACK-505
title: Add drill-down navigation for task dependencies in Web UI
status: Done
assignee: []
created_date: '2026-06-01 14:25'
updated_date: '2026-06-01 14:41'
labels: []
dependencies: []
modified_files:
  - src/web/components/Modal.tsx
  - src/web/components/DependencyInput.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
ordinal: 164400
actual_start: '2026-06-01 14:00'
actual_end: '2026-06-01 14:36'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable users to click on a dependency task in the task detail panel to open its details. Add a back/up button in the modal header to return to the parent task. Clicking the close button should close the entire task window stack.

This feature adds a navigation stack (`taskHistory`) in `App.tsx` so users can drill down into dependency tasks and navigate back without losing context.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a dependency task chip in the Dependencies section opens that task's detail panel
- [x] #2 A back/up arrow button appears in the modal header when viewing a drilled-down task
- [x] #3 Clicking the back button returns to the previous (parent) task
- [x] #4 Clicking the close button (×) closes the entire task modal and clears the navigation stack
- [x] #5 The navigation stack works correctly alongside create/edit mode (new tasks do not inherit history)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Approach

1. **`App.tsx`**: Added `taskHistory` state and a ref (`taskHistoryRef`) to track the navigation stack of opened tasks. Added `handleDrillDown` to push the current task onto history before opening the dependency task. Added `handleBack` to pop from history and restore the parent task. `handleCloseModal` now clears the entire stack.

2. **`Modal.tsx`**: Added `leftActions` prop to support rendering actions (back button) before the title in the sticky header.

3. **`DependencyInput.tsx`**: Added `onTaskClick` prop. When provided, dependency chips render as clickable buttons instead of plain spans. Clicking a chip triggers `onTaskClick(taskId)`.

4. **`TaskDetailsModal.tsx`**: Added `onDrillDown` and `onBack` props. Wired `onTaskClick` on `DependencyInput` to resolve the task ID and call `onDrillDown`. Rendered the back button in `leftActions` when `onBack` is present.
<!-- SECTION:NOTES:END -->
