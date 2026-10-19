---
id: BACK-728
title: Keep task list navigation working after the editor closes
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:48'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1070'
  - src/ui/task-viewer-with-search.ts
  - src/core/backlog.ts
modified_files:
  - src/ui/task-viewer-with-search.ts
  - src/types/neo-neo-bblessed.d.ts
  - src/core/backlog.ts
  - src/test/tui-task-viewer-focus.test.ts
  - src/test/tui-edit-session.test.ts
  - src/test/tui-interactive-editor-handoff.test.ts
type: bug
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the interactive `backlog task list`, pressing `E` opens the selected task in the editor. After the editor is closed, the list stops responding to navigation: j, k, and the arrow keys do not move the selection and clicking a row does not select it, while search, the filters, and the other hotkeys keep working (issue #1070, 1.53.0 on macOS; the same in Warp, Terminal.app, and iTerm2, with vim and nvim).

The reporter's workaround is to open search with `/` and leave it, after which navigation works again. That suggests the list does not get keyboard focus back when the editor closes, which is a lead to verify, not a confirmed cause.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the interactive `backlog task list`, after opening a task in the editor with `E` and quitting the editor, j, k, and the arrow keys move the selection again without any workaround.
- [x] #2 After the editor closes, clicking a row with the mouse selects it again.
- [x] #3 Navigation keeps working when the edit cycle is repeated several times in one session.
- [x] #4 Search, the filters, and the other hotkeys keep working after the editor closes, as they do today.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Root cause (reproduced in a real pseudo-terminal: tmux + vim `:q`, and equally with an editor stub that exits instantly):

A. Keyboard. `applyFilters()` in `src/ui/task-viewer-with-search.ts` destroys the list widget and builds a new one on every refresh. When the destroyed widget holds keyboard focus, blessed (`Node.remove` -> `screen.rewindFocus()`) hands focus to whichever widget held it earlier, never to the replacement: nothing on a fresh session (j, k and the arrows go nowhere), the search input once search has been used (the keys get typed into Search). The guess in the issue is right about the symptom, but the editor is only one trigger: the same `applyFilters()` path also breaks navigation after archive/complete and after a live update from disk. The detail pane goes through the same path (`applyFilters()` -> `refreshDetailPane()`); its `setImmediate` re-focus hides the problem on a fresh session, but focus still lands in the search input once search has been used.

B. Mouse. `Core.openEditor` in `src/core/backlog.ts` calls `screen.leave()`, which turns mouse reporting off, before `program.pause()` snapshots the mouse state, so `resume()` has nothing to restore and `screen.enter()` does not turn it back on. Every view that edits through `Core.editTaskInTui` shares this (task list, task detail, board). Keyboard navigation on the board is unaffected because it uses screen-level keys.

Plan:

1. Focus, in the shared rebuild path of the task viewer. Reuse the existing focus flows `focusTaskList()` and `focusDetailPane()` (the ones that leaving search, Esc and the pane keys already go through); add no second focus mechanism. Route every list rebuild through one function, `replaceTaskList()`: note whether the list widget holds focus, build the replacement, call `focusTaskList()`, and only then destroy the old widget, so blessed never rewinds focus elsewhere. Give `refreshDetailPane()` the same shape with `focusDetailPane()` and delete its `setImmediate` re-focus, which this makes obsolete. No timers, no re-focus calls at call sites, no key binding or footer changes.
2. Mouse, in the shared editor path. In `Core.openEditor`, remember whether mouse reporting was on before `screen.leave()` and turn it back on after `screen.enter()`.
3. Tests. An in-process viewer test that routes keys through blessed the way a terminal does: two consecutive edit cycles, the search-was-used case, the detail pane, and a live update. A unit test that `Core.openEditor` restores mouse reporting on a real blessed program. Extend the PTY (expect) editor-handoff scenario so CI checks j/k after the editor exits.
4. Verify for real in tmux with `EDITOR=vim`: two edit cycles with j, k, arrows and a mouse click, plus the board and task detail views; then scoped tests, `bunx tsc --noEmit`, `bun run check .`.

Not in this task (reported instead): a popup that is open while a live update rebuilds the panes still relies on the blessed focus rewind when it closes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch `tasks/back-728-list-focus-after-editor`.

Focus (`src/ui/task-viewer-with-search.ts`): every list rebuild now goes through `replaceTaskList()`, and `refreshDetailPane()` has the same shape. Each notes whether its widget holds keyboard focus, builds the replacement, hands focus over through the existing `focusTaskList()` / `focusDetailPane()`, and only then destroys the old widget, so blessed never rewinds focus to an older widget. `createTaskList()` no longer assigns `taskList` itself, and the `setImmediate` re-focus in the detail pane is gone. Because the fix sits in `applyFilters()`, it also covers the same loss of navigation after archive/complete and after a live update from disk.

Mouse (`src/core/backlog.ts`): `Core.openEditor` remembers whether mouse reporting was on before `screen.leave()` and turns it back on after `screen.enter()`. This is the shared editor path, so the board and the task detail view get it too.

Tests:
- `src/test/tui-task-viewer-focus.test.ts` drives the real viewer in-process and routes keys through blessed (two editor sessions, search used before editing, detail pane, live update). It needed an optional `screen` option on `viewTaskEnhanced`, mirroring the one `renderBoardTui` already has. On the unmodified code all four tests time out, because the old viewer ignores the `screen` option and draws on a screen the test cannot reach. With only that option added to the old code, all four fail on the selection assertions. The detail pane test also fails if the list replacement is changed to always take focus.
- `src/test/tui-edit-session.test.ts` checks mouse reporting on a real blessed program; it fails without the restore in `Core.openEditor`.
- `src/test/tui-interactive-editor-handoff.test.ts` gains a PTY scenario (two editor sessions, j and k) that CI runs against the compiled binary; on the old viewer it exits with code 94 (j does nothing after the first editor session).

Verified for real in tmux with `EDITOR=vim` (three edit cycles, including a saved edit) and `EDITOR=nvim` (two cycles): j, k, arrows and a mouse click move the selection after every cycle; search, filter popups and help still work; the task detail view and the board were checked too. An editor stub that exits instantly reproduces the bug as well, so it is not timing-dependent.

Left alone and reported: (1) a help or confirm popup that is open while a live update rebuilds the panes still relies on the blessed focus rewind when it closes, so navigation can be lost in that case; (2) resizing the terminal while the search input is focused drops focus, because the filter header rebuilds its controls; (3) the two existing "launches terminal editor" PTY tests are flaky on this machine on unmodified code as well (one of them timed out in 1 of 4 runs).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In the interactive task list, j, k, the arrow keys and mouse row selection work again after a task is edited with `E` and the editor is closed, including across repeated edits. The selection stays on the edited task and the list shows the edited content as before.

What was wrong:
- The task viewer rebuilds its list widget on every refresh. blessed gives the focus of a destroyed widget to whichever widget held it earlier, never to the replacement, so after the editor closed the keys went nowhere, or into the search input once search had been used.
- `Core.openEditor` turned mouse reporting off when leaving the screen and never turned it back on.

What changed:
- `src/ui/task-viewer-with-search.ts`: every list rebuild goes through `replaceTaskList()`, and `refreshDetailPane()` follows the same order: build the replacement, hand focus over through the existing `focusTaskList()` / `focusDetailPane()`, then destroy the old widget. The `setImmediate` re-focus in the detail pane is removed.
- `src/core/backlog.ts`: `Core.openEditor` restores mouse reporting after the editor closes.

Because both fixes sit in shared paths, they also restore navigation after archiving or completing a task and after an outside edit while the list is open, keep focus in the task detail view, and restore mouse reporting on the board after the editor.

Verification:
- Real terminal (tmux, run from source): three consecutive edit cycles with vim and two with nvim; after each, j, k, Down, Up and a mouse click moved the selection. Search, the filter pickers and help still worked. The same steps on the unmodified code reproduced the bug.
- `bun test --timeout=10000 src/test/tui-task-viewer-focus.test.ts src/test/tui-edit-session.test.ts`: 8 pass. The new tests fail on the old rebuild logic.
- `RUN_INTERACTIVE_TUI_TESTS=1 bun test --timeout=30000 src/test/tui-interactive-editor-handoff.test.ts src/test/tui-ready-filter-pty.test.ts src/test/board-tui-multi-move-pty.test.ts`: 7 pass, including the new two-session scenario.
- `bunx tsc --noEmit` and `bun run check .` pass.

Not fixed here:
- Closing the help popup after a live update happened while it was open leaves j and k without effect until search is opened and closed.
- Resizing the terminal while typing in search drops focus from the search input.
- The two existing "launches terminal editor" PTY tests are flaky on unmodified code as well.
<!-- SECTION:FINAL_SUMMARY:END -->
