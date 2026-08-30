---
id: BACK-661
title: TUI multi-select move with shift-arrow recruitment
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 17:23'
updated_date: '2026-08-30 22:44'
labels:
  - tui
  - enhancement
dependencies: []
ordinal: 293000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Maintainer-designed flow for moving several tasks in the TUI board, built on the existing single-task m mover without overloading its keys. In move mode (entered with m): plain arrows keep todays behavior exactly (reorder within the column / move across columns, ghost previews the landing spot). Shift+Up/Down walk a separate highlight to the next/previous task while the grabbed task stays in its original position. M (shift+m) toggles the highlighted task in and out of the move selection. Tasks selected for moving keep the existing > indicator (not a circle) and stay in place until confirmation. After recruiting, plain arrows collapse the highlight back to the ghost and the preview shows where the whole set lands; the set remains reorderable, and non-adjacent selected tasks collapse next to each other at the target position. Enter confirms moving the whole set; Esc cancels and clears. Footer/help shows the move-mode keys in the existing hint style (uppercase letters are key indicators). Terminal caveat: shift-arrows require xterm-style modified keys (tmux needs xterm-keys); M-toggle must remain usable standalone where shift-arrows do not arrive. Core batch persistence (moveTasksToStatus with orderedTaskIds) already exists from BACK-645.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 m plus plain arrows behave byte-identically to todays single-task mover when nothing is recruited
- [x] #2 Shift+Up/Down move a visually distinct highlight without moving the grabbed task
- [x] #3 M toggles the highlighted task in and out of the selection; selected tasks show the > indicator and stay in place until Enter
- [x] #4 After recruiting, arrows preview the whole set and moving reorders it; non-adjacent selected tasks land adjacent at the target position
- [x] #5 Enter moves the set (per-task failures in the footer), Esc cancels and clears; popup/modal/filter guards are respected
- [x] #6 Footer hints cover the move-mode keys; the flow remains fully usable without shift-arrows via M
- [x] #7 TUI tests drive recruit, toggle-off, reorder-after-recruit, confirm, and cancel through a real pty or the existing keyboard harness
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Generalize MoveOperation in src/ui/board.ts (reuses: the existing moveOp single-task mover, its m entry key, the magenta ► ghost, the cyan move-mode selection bar, the popupOpen/filterPopupOpen/modalOpen guards, the movePending double-Enter guard, the transient footer): add selectedIds: string[] and highlightTaskId: string | null. With selectedIds empty and no highlight, every path (projection, arrows, reorderTask confirm) is unchanged - AC #1.
2. Shift+Up/Down (blessed key names S-up/S-down; verified key.full construction in neo-neo-bblessed program.ts: shift+arrow parses to name=up/down + shift, full=S-up/S-down) walk highlightTaskId through the target column recruitment-view rows, skipping the ghost; the grabbed task and targetIndex do not change. The existing cyan selection bar renders the highlight (renderView selectedId becomes highlight ?? grabbed), keeping the magenta ► on the ghost - visually distinct with no new styling machinery.
3. M / S-m in move mode toggles the highlighted task in/out of selectedIds (cross-branch refused with the existing cannot-move-branch transient footer); with no active highlight (tmux fallback), it toggles the task on the row directly below the grabbed row (else above), so the flow stays fully usable with plain arrows + M alone - AC #6. Outside move mode M still enters move mode as today; lowercase m keeps today's enter/confirm behavior.
4. Projection: getProjectedColumns removes only the grabbed task while a highlight is active (recruits stay in place, rendered with the existing ► indicator via a movingIds set through buildRenderedTaskListItems); when the highlight collapses (any plain arrow) it removes the whole set and splices the block - set members in board display order - at targetIndex, so the preview shows where the whole set lands and non-adjacent recruits land adjacent - AC #2/#3/#4. targetIndex is remapped across view switches with a small anchor-based mapInsertionIndex helper.
5. Enter: selectedIds empty -> today's core.reorderTask path untouched; non-empty -> collapse, build orderedTaskIds from the block projection, call core.moveTasksToStatus (BACK-645) with per-task failures in the transient footer; a lands-where-it-already-is comparison exits silently without writing (interaction-consistency no-op guard). Esc clears moveOp (selection + highlight) via the existing cancelMove; movePending covers the batch path - AC #5.
6. Footer move-mode hints in the existing style: [←→] Change Column | [↑↓] Reorder | [Shift+↑↓] Highlight | [M] Select | [Enter] Confirm | [Esc] Cancel; help-popup M entry updated - AC #6.
7. Tests: extend src/test/board-tui-move.test.ts keyboard harness (pressKey/renderedRows/footerText) with recruit, toggle-off, reorder-after-recruit, adjacency collapse, confirm incl. per-task failure, cancel, and single-mover parity; pty sanity capture following the expect harness pattern (RUN_INTERACTIVE_TUI_TESTS gate). bunx tsc --noEmit, bun run check ., bun test - AC #7.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-661-tui-multi-move as one generalization of the existing mover in src/ui/board.ts - no parallel flow.

Key-by-key behavior shipped:
- m: enters move mode exactly as before; in move mode it still confirms (unchanged). With nothing recruited, plain arrows/Enter/Esc run today's exact single-task paths (projection reduces to the single ghost, confirm still goes through core.reorderTask).
- Shift+Up/Down (blessed key names S-up/S-down, verified against neo-neo-bblessed program.ts key.full construction; xterm ESC[1;2A/B): walk the recruitment highlight through the target column's rows, skipping the ghost. The grabbed task and targetIndex never change. The highlight is rendered by moving the existing cyan move-mode selection bar (renderView selects highlight ?? grabbed), while the ghost keeps its magenta ►.
- M/S-m: outside move mode enters move mode (as before). In move mode it toggles the highlighted task in/out of moveOp.selectedIds; recruited tasks render with the existing ► indicator and stay in place while the highlight is active. With no highlight (terminals without xterm modified keys, e.g. tmux without xterm-keys) it toggles the task on the row directly below the grabbed row (above at the bottom), so plain arrows + M alone cover the full flow. Cross-branch tasks are refused with the existing transient-footer message.
- Plain arrows after recruiting: the first arrow collapses the highlight and switches the preview to the whole set landing as one block (board display order) at the ghost position; further arrows reorder the block; targetIndex is re-anchored across view switches by mapInsertionIndex (first shared task at-or-below the index).
- Enter with recruits: collapses, builds orderedTaskIds from the block projection, calls core.moveTasksToStatus (BACK-645) - per-task failures land in the transient footer while the rest still move. A lands-where-it-already-is comparison exits silently without writing. movePending guards double-Enter on both paths. Esc clears moveOp (selection + highlight) via the existing cancelMove.
- Footer move-mode hints: [←→] Change Column | [↑↓] Reorder | [Shift+↑↓] Highlight | [M] Select | [Enter] Confirm | [Esc] Cancel; help-popup M entry updated.

Validation: bunx tsc --noEmit clean; bun run check . clean; full bun test 2741 pass / 0 fail. src/test/board-tui-move.test.ts drives recruit, toggle-off, reorder-after-recruit, block bounds, cross-column confirm, adjacency-collapse confirm with highlight active, per-task failure footer, M-fallback recruit/unrecruit, and cancel through the existing keyboard harness. New pty capture src/test/board-tui-multi-move-pty.test.ts (expect, RUN_INTERACTIVE_TUI_TESTS=1) sends the raw ESC[1;2B shift-arrow plus M through a real pty and asserts the ► recruit marker renders; it needed an explicit stty size (sizeless pty under bun test) and a UTF-8 LANG (blessed downgrades ► to ? otherwise). Wired into scripts/run-tui-interactive-tests.sh.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Generalized the TUI board's single-task mover into the maintainer-designed multi-select move: Shift+Up/Down walk a recruitment highlight (the existing cyan bar) without moving the grabbed task, M toggles the highlighted task in/out of the set (with a below-the-ghost fallback so plain arrows + M alone stay fully usable where shift-arrows do not arrive), recruited tasks keep the existing ► indicator in place, plain arrows collapse the highlight and preview the whole set landing adjacent at the target, and Enter persists the set through core.moveTasksToStatus with per-task failures in the transient footer; Esc cancels. With nothing recruited the m flow is unchanged and still confirms via core.reorderTask. Verified with the extended board-tui-move keyboard-harness tests, a new expect pty capture sending real xterm shift-arrow sequences, tsc, biome, and the full bun test suite (2741 pass / 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
