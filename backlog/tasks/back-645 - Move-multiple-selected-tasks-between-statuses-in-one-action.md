---
id: BACK-645
title: Move multiple selected tasks between statuses in one action
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-29 18:57'
updated_date: '2026-08-30 17:26'
labels:
  - cli
  - tui
  - web
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/945'
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let users select several tasks and change their status in one action across surfaces, layered per the manifesto: canonical CLI first (`task edit` accepts multiple task IDs and loops the existing single-task edit path, with flags that cannot apply per-task across a batch rejected), and web board plus TUI batch selection as views over one shared core method (`moveTasksToStatus`) with partial-failure per-task error reporting. Implemented by contributor PR #945 (janosmiko); we are taking that PR over in place to preserve credit. Known defects fixed during takeover: the interactive wizard silently dropped extra IDs when `task edit` was called with multiple IDs and no flags; batch drag in the milestone board view changed status but ignored milestone lanes; ~45 lines of id-resolution/branch-guard logic were duplicated between reorderTask and moveTasksToStatus. Browser QA follow-ups fixed on the branch: a no-op batch drop fired a real move plus a full data reload, and the multi-select drag ghost showed only one card.

Note: this record was restored after the original file was lost while uncommitted; the task was created 2026-08-29 and the ID is kept because the PR branch's commit messages reference BACK-645.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI `task edit` with multiple IDs and a status flag updates every listed task via the existing single-task edit path, reporting per-task failures without aborting the batch
- [ ] #2 CLI `task edit` with multiple IDs and no batch-applicable flags fails with a clear error instead of silently opening the wizard for only the first ID
- [ ] #3 Web board batch moves route through the shared core method (moveTasksToStatus); batch drag in the milestone view applies the same milestone semantics as single-task drag. TUI batch selection was split out to BACK-661 after the maintainer rejected the m-key recruitment flow; the TUI keeps main's single-task mover
- [ ] #4 Ambiguous or unresolvable task IDs in a batch fail closed as per-task errors; no task is guessed
- [ ] #5 Id-resolution and cross-branch guard logic is shared between reorderTask and moveTasksToStatus rather than duplicated
- [ ] #6 Unrelated formatting churn is removed from the diff
- [ ] #7 Automated tests cover CLI batch edit, per-task failure reporting, web batch moves, and the milestone-lane case
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Rework of PR #945 on branch pr/batch-move-tasks per maintainer QA (head 954112f4). Each change names the existing interaction it reuses.

1. TUI - one move flow on the existing m mover (reuses: moveOp move mode in src/ui/board.ts, its entry key m, its arrow-key target movement, its magenta ghost preview + cyan move-mode row highlight, its transient-footer errors, its popupOpen/filterPopupOpen/modalOpen guards):
   a. Generalize MoveOperation to a marked set (taskIds, anchor first). m in normal mode enters move mode exactly as today with the selected task as anchor (N=1 pixel-identical).
   b. Arrows keep today's exact semantics: they move the anchor ghost/target. The anchor ghost occupies the spot where the whole set will land (existing preview).
   c. m while in move mode toggles the mark of the task at the anchor's insertion point (the task whose row the ghost occupies, shown directly below it). Marked tasks stay in place rendered with the mover's magenta family (reuses formatTaskListItem's isMarked branch from the PR, recolored to match the mover). Cross-branch tasks refuse with the existing cannot-move-branch transient footer.
   d. Enter confirms: build the target column's final order (column minus marked, block = anchor + marked in board display order inserted at the anchor position) and call core.moveTasksToStatus with orderedTaskIds; per-task failures use the PR's transient-footer report. N=1 no-position-change keeps today's silent exit guard. Esc cancels and clears (existing cancelMove generalized).
   e. DELETE the PR's separate batch mode: space marking, batchMoveTargetStatus, performBatchMove, shiftBatchMoveTarget, batch footer branch, marked-count idle suffix. Footer in move mode shows M=Mark, Enter=Confirm, Esc=Cancel in the existing hint style (uppercase letters stay key indicators). help-popup M entry updated, Space removed.
2. Core: extend moveTasksToStatus with optional orderedTaskIds for placed drops (reuses: reorderTask's neighbor-seeded ordinal calculation generalized to a block via a calculateBlockOrdinals helper in core/reorder.ts that equals calculateNewOrdinal at count=1, plus the existing resolveOrdinalConflicts + updateTasksBulk write path and the shared resolveTasksForBoardMove/cross-branch/milestone helpers). Without orderedTaskIds the current append-to-end semantics are unchanged (web endpoint untouched).
3. Web no-op drop (reuses: TaskColumn's existing dropPosition + isOrderUnchanged guard): root cause - the card-level dragover early-returns when hovering the dragged card itself, dropPosition stays null, and handleDrop falls back to append-to-end, so a lift-and-release-in-place fires a real reorder that also moves the card to the bottom. Fix: record dropPosition {index, position:'self'} while hovering the dragged card (no indicator rendered), and map 'self' to the card's current position in handleDrop so the existing isOrderUnchanged guard makes it a pure no-op. Batch and milestone-lane in-place drops stay inert via the existing landsWhereItAlreadyIs guard; add tests for all three paths.
4. Web drag ghost (reuses: buildSelectionDragImage stacked ghost + board card classes): count the set that will actually move. Fix the selection-minus-dragged case - a modifier-press-drag on a not-yet-selected card starts the drag before the click registers; at dragstart with ctrl/meta held and an existing selection, add the card to the selection (existing onSelect toggle) and badge selectionCount+1. Stack depth reflects the count (min 3 layers). Tests pin badge and stack for 2 and 3 selected.
5. Tests: rewrite board-tui-batch-move.test.ts to drive the unified m flow (mark/toggle/confirm/cancel/cross-branch/footer), extend core-move-tasks-to-status.test.ts with orderedTaskIds placement cases, extend web-board-batch-move.test.tsx with the no-op and ghost cases. Update help-popup/footer test expectations. bunx tsc --noEmit, bun run check ., bun test all green.
6. Push fast-forward to fork branch pr/batch-move-tasks; contributor commits preserved.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rework round 2 (maintainer QA feedback), on pr/batch-move-tasks:
- TUI: deleted the space-marking batch mode entirely; moveOp generalized to a marked set (anchor first). m enters move mode as before; in move mode m toggles the task directly below the ghost (the spot the ghost occupies); Enter confirms all marked, Esc cancels. Confirm routes through core.moveTasksToStatus with the new orderedTaskIds placement, so the set lands exactly where the ghost previewed.
- Core: moveTasksToStatus accepts optional orderedTaskIds; block ordinal seeding via calculateBlockOrdinals in core/reorder.ts (count=1 matches calculateNewOrdinal's midpoint math); append semantics unchanged when the param is absent.
- Web no-op root cause: card-level dragover early-returned when hovering the dragged card itself, leaving dropPosition null, so handleDrop fell back to append-to-end - an in-place release both fired a reorder and moved the card to the bottom. Fixed with a 'self' dropPosition that resolves to the card's current spot and trips the existing isOrderUnchanged guard. Verified live in Chromium: in-place release (single and batch) sends no request; real drags send exactly one.
- Web ghost: badge now counts the set that actually moves; a ctrl/cmd-press-drag on a not-yet-selected card joins the selection at dragstart (the click never completes in that gesture), fixing the selection-minus-dragged badge and the drop moving one card short. Stack depth follows the count.

Thread-triage round (head bd4ba137): board-move dedup and CLI batch dedup now use canonical task identity (leading zeros collapse, bare numbers keep the default prefix); shift-range skips cross-branch cards; selection prunes to filter-visible cards; append places arriving tasks after the column as rendered with non-finite ordinals treated as missing; already-in-status tasks keep their ordinal in a mixed batch (named lane still applies); double-Enter guard on the TUI confirm. Regression tests added for each.

Maintainer re-test follow-up (head 551323e7): during a selection drag, every selected card now carries the grabbed card's existing isDragging treatment (opacity/rotate/scale) via a board-level selection-drag flag; cleared on dragend and on selection clear. jsdom test pins companion styling on dragstart and its removal on dragend.

Maintainer decision: the TUI multi-mark flow is rejected (overloading m collides with within-column reordering) and split to successor task BACK-661 (maintainer-designed shift-arrow recruitment). The branch now ships CLI batch edit + web multi-select (no-op guards, drag ghost, selection-drag styling) + core moveTasksToStatus with orderedTaskIds placement (used by the web API and the upcoming BACK-661 TUI design). src/ui/board.ts is back to main's single-task mover except a standalone double-Enter movePending guard; TUI tests rewritten as board-tui-move.test.ts asserting main's single-mover semantics.
<!-- SECTION:NOTES:END -->
