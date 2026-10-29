---
id: BACK-633
title: Scroll the task detail pane with Shift+J/K without leaving the list
status: Done
assignee:
  - '@claude'
created_date: '2026-08-11 17:03'
updated_date: '2026-08-11 17:07'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/769'
  - 'https://github.com/MrLesk/Backlog.md/pull/771'
type: enhancement
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the task-list TUI view, the detail pane can only be scrolled after moving focus into it (right/l or Enter). Bind Shift+J / Shift+K as screen-level shortcuts that scroll the detail pane body from either pane, so the list keeps focus while long descriptions are read. The shortcut must stay inert while the filter bar is focused, a popup or modal is open, or there is no detail pane, and it must never trigger the boundary handoff into the search field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shift+J / Shift+K scroll the detail pane from the task list without moving focus
- [x] #2 The shortcut is inert while filters are focused, a popup or modal is open, or no detail pane exists
- [x] #3 Plain j/k navigation and the arrow-key boundary search handoff are unaffected
- [x] #4 Helper branches are fully covered by unit tests and the help popup documents the shortcut
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Export a pure helper shouldScrollDetailPaneFromShortcut(currentFocus, modalOpen, filterPopupOpen, hasDetailPane) in src/ui/task-viewer-with-search.ts. 2. Add screen-level key bindings ['J','S-j'] / ['K','S-k'] that scroll descriptionBox by +/-1 line through the helper without moving focus. 3. Add the 'J/K - Scroll task details' entry to the task-list help popup. 4. Unit-test every helper branch in src/test/task-viewer-detail-scroll.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebased onto upstream/main after BACK-584 (#866) reshaped boundary navigation. No textual conflicts; the helper composes cleanly with the new shouldMoveFromDetailBoundaryToSearch(scrollOffset, key) signature and adds no interaction with it. Originally filed as BACK-537, but upstream allocated that ID to 'Make checklist edits and serialization deterministic' on 2026-07-11; the task was recreated through the CLI allocator as BACK-633 to remove the duplicate ID from the PR.

Note on scope after #866: the original motivation included 'must never trigger the boundary handoff into the search field'. BACK-584 already made k at the top of the detail pane stay put, so that clause is now satisfied upstream independently; the remaining value of this change is scrolling the detail pane while the list keeps focus.

Verification evidence:
- Unit: src/test/task-viewer-detail-scroll.test.ts covers all six helper branches (focus in list, focus in detail, filters focused, modal open, filter popup open, no detail pane).
- Real PTY (tmux, 200x50, temp project with a 60-line description): Shift+J five times scrolled the detail body from line-1 to line-2-at-top without changing the selected task; three Shift+K scrolled back; a subsequent plain j moved the selection to TASK-2, proving focus never left the list. With the search field focused, J was inserted as a literal character ('Search: J') and the detail pane did not scroll.
- Regression: src/test/tui-vim-boundary-navigation.test.ts and src/test/task-viewer-boundary-navigation.test.ts pass unchanged (25 tests), so BACK-584's j/k and arrow behaviour is untouched.
- bunx tsc --noEmit clean, bun run check . clean (374 files), bun run test 2250 pass / 6 skip / 1 fail. The single failure is src/test/tui-window-title.test.ts, which fails identically on unmodified upstream/main in this environment (tmux rewrites the terminal escape sequences the test asserts on), so it is pre-existing and unrelated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bound Shift+J / Shift+K as screen-level shortcuts that scroll the task detail pane body while the task list keeps focus, so long descriptions can be read without bouncing focus between panes. Guarded by a pure exported helper that keeps the shortcut inert while the filter bar is focused, a modal or filter popup is open, or no detail pane exists; uppercase-only bindings follow the existing ['e','E','S-e'] idiom so plain j/k navigation is untouched. Help popup documents the shortcut. Verified with per-branch unit tests, a real-PTY tmux check of both the scroll and the focus-retention claim, the unchanged BACK-584 navigation suites, and clean tsc/biome.
<!-- SECTION:FINAL_SUMMARY:END -->
