---
id: BACK-661
title: TUI multi-select move with shift-arrow recruitment
status: To Do
assignee: []
created_date: '2026-08-30 17:23'
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
- [ ] #1 m plus plain arrows behave byte-identically to todays single-task mover when nothing is recruited
- [ ] #2 Shift+Up/Down move a visually distinct highlight without moving the grabbed task
- [ ] #3 M toggles the highlighted task in and out of the selection; selected tasks show the > indicator and stay in place until Enter
- [ ] #4 After recruiting, arrows preview the whole set and moving reorders it; non-adjacent selected tasks land adjacent at the target position
- [ ] #5 Enter moves the set (per-task failures in the footer), Esc cancels and clears; popup/modal/filter guards are respected
- [ ] #6 Footer hints cover the move-mode keys; the flow remains fully usable without shift-arrows via M
- [ ] #7 TUI tests drive recruit, toggle-off, reorder-after-recruit, confirm, and cancel through a real pty or the existing keyboard harness
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
