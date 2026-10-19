---
id: BACK-617
title: Fix web board drag-and-drop when hideEmptyColumns is enabled
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 16:05'
updated_date: '2026-08-09 16:38'
labels: []
dependencies: []
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex 2026-08-09. Shipped defect in the BACK-522 web board code, reported with analysis by janosmiko during PR #808: Board.tsx flips isDragging synchronously inside dragstart, which re-inserts hidden columns mid-drag; per his report Chromium cancels the native drag as a result, so cards become undraggable whenever hideEmptyColumns is on. First verify the defect against the current web board, then fix. His unmerged hardening from PR #808 (deferred column expansion, scroll preservation, edge auto-scroll) is the starting point; take what applies with credit (cherry-pick or Co-authored-by) and keep the scope to making drag work correctly with hidden columns, not a general DnD overhaul.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With hideEmptyColumns enabled, cards can be dragged and dropped on the web board in Chromium
- [x] #2 Hidden empty columns become available as drop targets during a drag, consistent with the TUI move-mode behavior
- [x] #3 Contributor credit is preserved where his changes are used
- [x] #4 Tests cover dragging with hidden columns on and off
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce in Chromium against current main: serve the web UI over a scratch project with hideEmptyColumns on and drive a real native drag; record the event trace and the DOM state before/after React's dragstart handler.
2. Fix Board.tsx: keep dragSourceStatus/dragSourceLane synchronous (they do not break the drag) but move the hidden-column reveal behind a deferred flag set in a setTimeout(0) task, so the board layout is not mutated inside the dragstart dispatch. Only arm the timer when hideEmptyColumns is on so the toggle-off path is unchanged. Clear the timer on dragend and on unmount.
3. Adapt the deferred-expansion idea from janosmiko's PR #808 with credit (Co-authored-by + PR attribution); leave his scroll-preservation and edge auto-scroll out unless required by the core fix.
4. Add src/test/web-board-drag-hidden-columns.test.tsx: jsdom coverage for hidden columns on (no synchronous reveal on dragstart, reveal after the next task, drop onto a revealed column reorders, re-hide on dragend) and off (all columns present throughout).
5. Re-verify the fixed build in Chromium (drag survives, hidden columns appear mid-drag, drop onto a revealed column moves the task); run bunx tsc --noEmit, bun run check ., and the full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced first on current main in Chromium (chrome-devtools native drag against a scratch project: statuses To Do/In Progress/Done/Blocked, one task in In Progress, hideEmptyColumns on). Event trace was dragstart -> dragend with nothing in between: no drag, dragenter, dragover or drop, so the browser aborted the drag immediately. Instrumenting around React's handler showed why: before React ran, 1 column was rendered; still inside the same dragstart dispatch, after React's handler, 4 columns were rendered. The dragged card node itself stayed connected and identical, so this is the board layout mutating during dragstart, not the source node being replaced. Same drag with hideEmptyColumns off gave the full dragstart/drag/dragenter/dragover/drop/dragend sequence and moved the task, confirming the harness performs a real native drag.

Fix keeps dragSourceStatus/dragSourceLane synchronous (they re-render columns without breaking the drag, as the toggle-off control proves) and moves only the hidden-column reveal behind hiddenColumnsRevealed, set from a setTimeout(0) armed in handleColumnDragStart. The timer is only armed when hideEmptyColumns is on, so the toggle-off path arms nothing and changes no state. handleColumnDragEnd cancels the timer and resets all three values in one batch; the same cancel runs on unmount.

Credit: the diagnosis and the deferred-expansion remedy come from janosmiko's unmerged PR #808 (commit 63e36249). Cherry-picking was not practical because his commit also carries the web toggle button, the TUI work already landed in BACK-615, and README changes, so it is carried as a Co-authored-by trailer plus PR-body attribution. His scroll-preservation and edge auto-scroll commit (9b875573) is deliberately out of scope: neither is needed to make the drag work, and the underlying no-auto-scroll limitation affects wide boards identically when hideEmptyColumns is off.

Post-fix verification in Chromium, hideEmptyColumns on: dragging TASK-2 from To Do onto the Blocked column completed the whole native sequence (dragstart, drag, dragenter, dragover, drop, dragend) and moved the task on disk. The trace shows the reveal landing mid-drag: the first dragover saw 'To Do|Blocked', the next saw 'To Do|In Progress|Done|Blocked'. A separate probe run read the DOM during a live drag and found the previously hidden Done column laid out at x 924-1202 (width 278), hit-testable via elementFromPoint at its centre, and rendering its 'Drop to move' affordance. With hideEmptyColumns off the trace and the resulting move are unchanged from the pre-fix control run.

jsdom limits, stated plainly: jsdom has no drag controller, so the test suite cannot show the Chromium cancellation itself or anything about layout, scrolling or hit testing. What src/test/web-board-drag-hidden-columns.test.tsx does prove is the invariant that avoids the cancellation (dragstart leaves the rendered column set untouched), that the hidden columns arrive on the next task, that dropping on one of those revealed columns reorders into it, that dragend re-hides them and cancels a reveal that has not run yet, and that the column set never changes at any point when hideEmptyColumns is off. The first of those assertions fails against unfixed Board.tsx (verified by stashing the fix).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web board cards were undraggable whenever hideEmptyColumns was on: Board.tsx re-showed the hidden empty columns from inside the dragstart handler, and Chromium aborts a native drag whose dragstart mutates the board layout. Confirmed on main in Chromium before changing anything (dragstart followed straight by dragend, no drag/dragover/drop; 1 column before React's handler, 4 columns after it, still inside the same dispatch), with the toggle-off case completing a real drop as a control. The reveal now sits behind a hiddenColumnsRevealed flag set from a setTimeout(0) armed in a shared handleColumnDragStart, so the columns arrive on the next task once the browser has committed the drag; the timer is only armed when hideEmptyColumns is on, and handleColumnDragEnd cancels it and clears the drag state in one batch. Verified in Chromium after the fix: the drag completes and moves the task with hideEmptyColumns on, the hidden columns appear mid-drag and are laid out, hit-testable and showing their drop affordance, and the toggle-off behaviour is unchanged. src/test/web-board-drag-hidden-columns.test.tsx covers the jsdom-provable parts for both toggle states and fails against the unfixed component. bunx tsc --noEmit, bun run check . and bun run test (2179 pass, 6 skip, 0 fail) are clean. Diagnosis and the deferred-reveal remedy are janosmiko's from unmerged PR #808, credited with a Co-authored-by trailer; his scroll-preservation and edge auto-scroll extras are out of scope.
<!-- SECTION:FINAL_SUMMARY:END -->
