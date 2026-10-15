---
id: BACK-708
title: Add comments from the TUI
status: In Progress
assignee:
  - '@syhol'
created_date: '2026-10-04 18:56'
updated_date: '2026-10-04 19:16'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1057'
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task comments can be added from the CLI (backlog task edit --comment), MCP and the web task modal, and the TUI shows them in the task detail, but the TUI has no way to add one. Replying to a comment, such as a question an agent left on a task, means leaving the board for the CLI or the browser. Proposed in https://github.com/MrLesk/Backlog.md/issues/1057.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing O on a board card, in the board task popup, or in the task list opens a comment composer for the selected task
- [x] #2 The composer has an optional Author field and a multi-line Comment field; Add comment or Ctrl+S appends the comment, and Esc or Cancel closes without changes
- [x] #3 Comments are saved through the same update path as backlog task edit --comment with the same validation; an empty or rejected comment shows the error in the composer and keeps the draft
- [x] #4 The Author field is prefilled with the last author used in the current TUI session
- [x] #5 Tasks from other branches cannot be commented on, and the user is told why
- [x] #6 While the composer is open, global TUI shortcuts do not trigger
- [x] #7 The TUI help and footers list the comment shortcut
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a comment composer modal (src/ui/components/comment-composer.ts) modelled on the task composer: Author textbox, Comment textarea, Add comment / Cancel actions, Tab/Shift+Tab, Esc, Ctrl+S, errors shown in the modal. 2. Share the task composer's code-point-safe text editing (caret, insertion, deletion) through one exported helper instead of duplicating it. 3. Add a TUI helper that refuses non-local/other-branch tasks, opens the composer, and persists through core.editTask with appendComments, remembering the last author for the session. 4. Bind O on the board, the board task popup and the task list under each view's modal guard, and refresh the view with the returned task. 5. List the shortcut in the footers and as its own help row; adjust the help popup sizing test for the extra row. 6. Cover the composer with focused tests and run tsc, Biome and the test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned. O on the board, the board task popup and the task list opens a comment composer modal (src/ui/components/comment-composer.ts) with an optional Author field (prefilled with the session's last author), a multi-line Comment field, Add comment / Cancel, Tab/Shift+Tab, Esc and Ctrl+S. src/ui/task-comment.ts refuses non-local or other-branch tasks and saves through core.editTask with appendComments, the same path as backlog task edit --comment. Each view runs the composer under its modal guard. The task composer's code-point-safe text editing is now the shared ownComposerTextEditing() in task-composer.ts. The shortcut has its own help row; the board help list no longer fits 24 rows, so help-popup.test.ts now checks the full fit at 40 rows and the margin at 24. Adding the row exposed an off-by-one in createPopupChrome: the backdrop was centred with floor((H - h) / 2) while blessed centres the popup with floor(H / 2) - floor(h / 2), so popups whose height parity differed from the screen's sat a row off their backdrop; the backdrop now uses blessed's formula, with a test.

Validation: bunx tsc --noEmit and bun run check . pass. New tests: tui-comment-composer.test.ts (6), tui-task-comment.test.ts (3), board-tui-comment.test.ts (1; fails with the modal guard removed), plus the help-popup backdrop test (fails without the centring fix). Full bun run test: 2,887 passed, 1 failed (board-tui-move.test.ts, a timing-sensitive test that also fails intermittently on main: 1 of 8 isolated runs on main). Manual: Ctrl+S, the comment flow and the help popup layout checked in a real terminal by @syhol.

Recorded demo (VHS, 44s) on a scratch project: O on a board card adds a comment and the footer confirms it; O in the TASK-2 popup prefills the author and the popup shows the new comment; a body with a standalone --- line shows the CLI's error in the composer with the draft kept; O in the task list adds a comment shown in the detail pane; the help popup lists O on its own row. All saved comments were confirmed in the task files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adds comments to the TUI. O on a board card, in the board task popup or in the task list opens a comment composer modal styled like the Create Task composer (optional Author prefilled with the session's last author, multi-line Comment, Add comment / Cancel, Tab, Esc, Ctrl+S). It saves through core.editTask with appendComments, the same path and validation as backlog task edit --comment; errors stay in the modal with the draft. Other-branch tasks are refused, and the composer runs under each view's modal guard. The task composer's code-point-safe text editing is shared through ownComposerTextEditing(). The shortcut has its own help row, so the board help now scrolls by one row on a 24-row terminal (help-popup.test.ts adjusted). Also fixes an off-by-one in createPopupChrome's backdrop centring that the extra row exposed. Verified with tsc, Biome, new focused tests (composer, helper, board isolation, footer/help, backdrop) and the full suite (one pre-existing intermittent failure in board-tui-move.test.ts), plus a recorded TUI demo. Open question in #1057: author prefill and whether to fold O into the Edit help row.
<!-- SECTION:FINAL_SUMMARY:END -->
