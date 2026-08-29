---
id: BACK-644
title: Keep the board task popup in sync with live task state
status: Done
assignee:
  - '@claude'
created_date: '2026-08-29 17:59'
updated_date: '2026-08-29 21:30'
labels:
  - tui
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/952'
  - 'https://github.com/MrLesk/Backlog.md/issues/951'
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The board task popup renders from a Task object captured when it opens, so edits made after opening (external editor via E, or any out-of-process agent/CLI edit picked up by the task watcher) leave the popup stale; confirmations can even target a ghost title. Contributor PR #952 (bjohas) correctly extracts a rebuildable openTaskPopup(task) but triggers refresh only from the editor-return path. Take over that PR in place and drive popup rebuild/close from the board's existing watcher-fed updateBoard funnel instead, mirroring the TUI list view's pattern, so every change path refreshes the popup with one mechanism.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After editing a task via E from the board popup, the reopened/refreshed popup shows the updated content and its key handlers act on the updated task
- [x] #2 An out-of-process edit to the open popup's task (external CLI edit while the board is running) refreshes the popup content without user action
- [x] #3 If the popup's task is completed, archived, or deleted externally while open, the popup closes with a visible notice instead of offering actions on a missing task
- [x] #4 Popup refresh uses the board's existing update funnel; no parallel refresh channel or editor return-value plumbing remains
- [x] #5 Watcher echo after an in-popup edit does not cause visible double-rebuild or flicker
- [x] #6 Automated TUI tests cover the editor path, the external-edit path, and the external-removal path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Take over PR #952 in place: keep bjohas's openTaskPopup(task) extraction, revert openTaskEditor to Promise<void> (drop the Task | null return-value plumbing and the E-handler's manual close/reopen).
2. Export the watcher's content signature helper (taskSignature -> taskContentSignature in src/utils/task-watcher.ts) so board and watcher share one definition; it already excludes branch/filePath/lastModified/source.
3. Track the open popup as board state: openPopup = { taskId, signature, close }, set inside openTaskPopup and cleared on every close path (Escape/q, complete, archive).
4. Add syncOpenPopup(): resolve the popup's task in currentTasks; if gone -> close popup, restore column focus, showTransientFooter notice; if content signature changed -> close and rebuild via openTaskPopup(nextTask); otherwise no-op (this is what swallows the watcher echo, AC #5).
5. Drive syncOpenPopup from the board's existing updateBoard funnel, next to the taskCreationOpen guard, so watcher-fed updates refresh the popup.
6. Route the editor result through updateBoard instead of openTaskEditor's local currentTasks mutation, so the E path refreshes the popup through the same funnel with no second channel.
7. Add automated TUI tests driving renderBoardTui with an injected screen + subscribeUpdates for: editor path, external-edit path, external-removal path.
8. Verify bunx tsc --noEmit, bun run check ., bun test; report the pre-existing Escape-focus quirk if it is not naturally fixed here.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Took over contributor PR #952 (bjohas) in place; his openTaskPopup(task) extraction is kept as the rebuild primitive.

Changed vs the contributor's version:
- Reverted openTaskEditor to Promise<void>; the Task | null return-value plumbing and the E handler's manual close/reopen are gone. openTaskEditor now feeds its reconciled task list into updateBoard(nextTasks, []) instead of assigning currentTasks directly, so the editor and the watcher share one update path.
- Board state tracks the open popup as openPopup = { taskId, signature, close }, with one closeOpenPopup() used by Escape/q, complete, archive and the sync helper (previously two separate close+popupOpen=false pairs).
- syncOpenPopup() runs from updateBoard next to the taskCreationOpen guard: task gone -> close + focus the board + transient notice; content signature changed -> close and rebuild via openTaskPopup; otherwise no-op. It re-checks itself after a rebuild in case the board advanced again mid-rebuild.
- taskSignature in src/utils/task-watcher.ts is exported as taskContentSignature and reused by the board, so one definition decides what counts as a content change (it excludes branch/filePath/lastModified/source, which is what makes the post-edit watcher echo a no-op for the popup).
- Escape from the popup now focuses the column that currently holds the task instead of the column it was opened from. This pre-existing quirk became reachable once an external status change refreshes the popup rather than leaving it stale, so it is fixed here rather than reported.

Verification: new src/test/board-popup-sync.test.ts drives renderBoardTui with an injected screen, a stub core.editTaskInTui and a captured subscribeUpdates updater; 4 tests cover the editor path, the external-edit path, the external-removal path (asserting the footer notice) and the watcher echo (asserting the popup widget identity is preserved, so no rebuild). Stashing the board change makes the external-edit and external-removal tests fail, confirming they are not vacuous.

bunx tsc --noEmit clean. Biome clean on all files this task touched. Two repo-level conditions are pre-existing on the branch and unrelated: 'bun run check .' fails formatting on the untouched src/ui/components/task-composer.ts (CI runs check:types only, not Biome), and 'bun test' has 2 pre-existing failures in src/test/core.test.ts (archive-snapshot / equal-time branch record ID occupancy) that also fail with this change stashed. Full suite otherwise 2411 pass / 7 skip.

Review follow-up on maintainer PR #957 (Codex findings). Both confirmed real and fixed:

1. Rebuild vs confirmation dialog - REAL. The popup's c/a handlers open a confirm dialog through runWithModalGuard while the task popup stays alive underneath. A watcher update arriving mid-confirmation ran syncOpenPopup, which destroyed and recreated the popup; createTaskPopup's setImmediate(contentArea.focus()) then stole focus from the dialog. Because openConfirmPopup binds its keys to its own widget and only resolves when answered, the dialog became unanswerable and modalOpen stayed true, wedging the board. Fix mirrors the taskCreationOpen guard: syncOpenPopup sets popupSyncPending and returns while modalOpen is true, and runWithModalGuard's finally flushes the deferred sync once the dialog closes. Proven by a test asserting the dialog keeps focus across an external edit and that the deferred refresh lands after it is answered; the test fails without the guard.

2. Unclamped column index on focus restore - REAL, and reachable through the removal path rather than only Escape. focusColumn ignores an out-of-range index, so the failure mode is silent: no column is focused and the board stops responding to navigation. With hideEmptyColumns, a lane disappears when its last task goes, so currentCol can exceed columns.length - 1 exactly when the popup closes because its task was removed. Added restoreColumnFocus(), which clamps into range, and routed both the Escape path and the removal path through it. Proven by a test that opens the popup on the only Done task with hideEmptyColumns enabled, removes it externally, and asserts focus lands on a surviving column list; it fails without the clamp.

Not rebasing onto the moved origin/main: the push must stay fast-forward. CI runs on the pull_request merge result, which already carries main's formatting fix for the untouched src/ui/components/task-composer.ts, so the repo-wide 'bun run check' failure noted earlier does not apply to this PR.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-29 18:28
---
Implementation is complete, committed locally as 4f727552 on branch fix/board-popup-refresh (on top of bjohas's 6f714d88). Pushing the maintainer edit to the PR branch is blocked by GitHub: the head fork OpenDevEd/Backlog.md is organization-owned, and 'allow edits by maintainers' does not apply to org-owned forks. The API reports maintainerCanModify: true, but 'git push' returns 403 'Permission to OpenDevEd/Backlog.md.git denied to MrLesk' and repos/OpenDevEd/Backlog.md reports push: false for this account. Auth is fine (repo scope present). Needs a decision from Alex: ask OpenDevEd to grant push access on the fork branch, ask bjohas to apply the patch, or supersede PR #952 with a maintainer branch on origin.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The board popup now tracks live task state through the board's own update funnel. renderBoardTui remembers the open popup as { taskId, contentSignature, close }; updateBoard (the watcher-fed entry point) calls syncOpenPopup, which rebuilds the popup via bjohas's openTaskPopup when the task's content signature changed, closes it with a transient footer notice when the task left the board, and does nothing when only read metadata moved - which is what makes the watcher echo after an in-popup edit invisible. The editor path routes its result through the same updateBoard call, so the Task | null return-value plumbing through openTaskEditor is gone and there is one refresh mechanism. taskContentSignature is now exported from the task watcher and shared by both. Escape from the popup follows the task to its current column. Verified by src/test/board-popup-sync.test.ts (4 tests: editor path, external edit, external removal, watcher echo) driving the real board with an injected screen and subscribeUpdates; the external-edit and external-removal tests fail with the board change stashed. bunx tsc --noEmit clean, Biome clean on touched files, full suite at the branch's pre-existing baseline.
<!-- SECTION:FINAL_SUMMARY:END -->
