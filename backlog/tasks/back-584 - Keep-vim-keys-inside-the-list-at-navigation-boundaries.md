---
id: BACK-584
title: Keep vim keys inside the list at navigation boundaries
status: Done
assignee:
  - '@claude'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-07 21:31'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/768'
  - 'https://github.com/MrLesk/Backlog.md/issues/770'
priority: medium
type: enhancement
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issues #768 and #770. Today j/k at the top or bottom of the task list, the detail pane, and the board (including empty columns) hands focus to the search input. That handoff was deliberate (BACK-399), but it surprises vim users, who expect j/k to stop at a boundary rather than leave the list. PR #770 proposed a `wrapNavigationToSearch` config key.

Maintainer decision (confirmed): no new config key. Instead, j and k never enter the search input at boundaries, while the arrow keys keep the existing boundary handoff into search. `/` and Ctrl+F continue to focus the search input directly. This preserves the discoverability BACK-399 was after for arrow-key users while giving vim users the behavior they expect, without adding configuration surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 j at the last row keeps focus in place in the task list, the detail pane, and the board (including empty columns)
- [x] #2 k at the first row keeps focus in place on the same three surfaces
- [x] #3 ArrowDown at the last row and ArrowUp at the first row still hand focus off to the search input
- [x] #4 `/` and Ctrl+F still focus the search input directly
- [x] #5 No new configuration key is introduced
- [x] #6 Existing navigation tests are updated to the new j/k behavior
- [x] #7 Help text and docs that describe the old j/k boundary behavior are updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Teach GenericList which key family drove vertical navigation: add a BoundaryNavigationKey type ("arrow" | "vim"), split the up/k and down/j bindings, and pass the kind to onBoundaryNavigation. Lists without a boundary handler (filter popups) keep today's circular wrap for both families.
2. Replace shouldMoveFromListBoundaryToSearch with one shared resolver in task-viewer-with-search.ts: resolveListBoundaryNavigation(direction, selectedIndex, total, key) -> "move" | "search" | "stay". Arrow keys at a boundary (and in an empty list) resolve to "search"; vim keys resolve to "stay".
3. Task list: use the resolver in the onBoundaryNavigation callback; consume the key on "stay" so j/k neither wrap nor hand off.
4. Detail pane: shouldMoveFromDetailBoundaryToSearch takes the key kind; bind up and k separately so k falls through to the built-in scroll (which is already clamped at the top).
5. Board: split the screen-level up/k and down/j bindings and route both through the resolver, collapsing the empty-column special case into the resolver's empty-list branch.
6. Tests: resolver + detail helper unit tests; GenericList widget tests driving real key events; a board TUI test with a fake screen covering a populated column and an empty column for j/k vs arrows. No config key, no docs change (nothing user-facing documents the handoff).
7. Verify: bunx tsc --noEmit, bun run check ., scoped TUI tests, full bun test, plus a real-PTY spot check of the board.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the no-config split: the key family that drove vertical navigation is now carried to every boundary site.

- src/ui/components/generic-list.ts: added BoundaryNavigationKey ("arrow" | "vim"), split the up/k and down/j bindings, and pass the kind to onBoundaryNavigation. Lists without a boundary handler (filter popups, pickers) keep today's circular wrap for both key families, so only the surfaces with a search handoff change.
- src/ui/task-viewer-with-search.ts: replaced shouldMoveFromListBoundaryToSearch with resolveListBoundaryNavigation(direction, selectedIndex, total, key) -> "move" | "search" | "stay", shared by the task list and the board. Arrow keys at a boundary (and in an empty list) resolve to "search"; vim keys resolve to "stay", and the task-list callback returns true on "stay" so j/k neither wrap nor hand off. shouldMoveFromDetailBoundaryToSearch now takes (scrollOffset, key) and its vestigial direction argument is gone; the detail pane binds up and k separately, and k falls through to the built-in vi scroll which is already clamped at the top.
- src/ui/board.ts: the two screen-level handlers collapsed into one moveBoardSelection(direction, key) used by four bindings; the empty-column special case is now the resolver's empty-list branch (pendingSearchWrap stays null there because an empty column has no row to return to).

No config key, no new behavior for / and Ctrl+F (their bindings are untouched), and mid-list j/k is unchanged.

Verification evidence:
- New src/test/tui-vim-boundary-navigation.test.ts drives real key events: a GenericList wired with the viewer's boundary callback (j at the last row and k at the first row keep the selection and record no handoff; arrows at the same rows hand off) and a real renderBoardTui on a fake screen for both a populated column and an empty column (j/k keep focus on the column list; Down/Up move focus to the search textbox).
- src/test/task-viewer-boundary-navigation.test.ts updated to the new resolver and detail-pane helper, including the empty-list branch.
- Mutation control: forcing the resolver to return "search" for vim keys fails 3 of the 4 new behavior tests, so they are not vacuous.
- Real PTY spot check with expect (task list TUI and board TUI in a temp project, markers read off the footer): j past the last row and k at the top of the detail pane never focus search, while Down/Up at the same boundaries do; empty board column behaves the same. Same scripts exit 1 against the pre-fix behavior.
- bunx tsc --noEmit clean, bun run check . clean, bun run test 1951 pass / 5 skip / 0 fail.
- AC #7: nothing shipped documents the old j/k boundary behavior (grepped README, ADVANCED-CONFIG, CLI-INSTRUCTIONS, AGENTS, CONTRIBUTING, DEVELOPMENT, src/guidelines, help popup and footers). The only boundary copy is the search-focused footer '[up/down] Back to Tasks/Board' and the help popup's 'arrows Navigate tasks', both arrow-key statements that stay accurate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
j and k now stay inside the list at navigation boundaries in the task list, the detail pane, and the kanban board (including empty columns), while the arrow keys keep the BACK-399 handoff into the search input and / and Ctrl+F still focus search directly. No configuration key was added: GenericList and the board handlers now report which key family drove the navigation, and a shared resolveListBoundaryNavigation helper decides between moving, handing off to search, and staying put. Verified with new key-event tests over a real GenericList and a real board TUI (populated and empty columns), updated helper tests, a mutation control run proving the tests are not vacuous, a real-PTY expect check of both TUIs, and tsc/biome/full bun test.
<!-- SECTION:FINAL_SUMMARY:END -->
