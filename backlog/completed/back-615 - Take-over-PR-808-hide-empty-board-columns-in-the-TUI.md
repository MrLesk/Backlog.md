---
id: BACK-615
title: 'Take over PR #808: hide empty board columns in the TUI'
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-09 15:04'
labels: []
dependencies: []
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Takeover approved by Alex (2026-08-07 takeover-mode ruling, reconfirmed 2026-08-09: "ok fine to take over. and go by our rules"). Take over the contributor branch from https://github.com/MrLesk/Backlog.md/pull/808, preserve the author credit via cherry-pick, bring it up to date with main, complete it to project standards, and prepare it for merge. Owner constraint from the original ruling: the change is fine as long as the TUI footer does not get overcrowded. Evaluate the PR approach first; if the current implementation conflicts with the rewritten board/TUI code that landed since (BACK-565, BACK-605, BACK-609), reimplement minimally while preserving authorship of the original commits where feasible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Empty columns are hidden on the TUI board per the intent of PR #808
- [x] #2 The TUI footer does not become overcrowded
- [x] #3 Original author credit is preserved in the commit history where feasible
- [x] #4 Tests cover the empty-column behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Study PR #808 (janosmiko): it targets the already-shipped hideEmptyColumns config key (BACK-522, web-only) and adds a TUI S-h hotkey plus a pure filterVisibleColumns helper, a web toolbar button, web drag-and-drop hardening, a footer hint, a help-popup entry and README copy. Precedence check: no competing mechanism - the config key exists and the contributor's toggle writes that same key, so the takeover is 'make the TUI honor the existing key' plus his hotkey.
2. Scope to the TUI per this task's acceptance criteria: keep the web board untouched (the config key already drives it) and leave the web toolbar button and drag-and-drop fixes for a separate decision.
3. Cherry-pick the contributor's first commit with authorship preserved, adapted to the reworked board (enhanced-views.ts and simple-unified-view.ts no longer exist; renderBoardTui now resolves Core through getCore()).
4. Thread hideEmptyColumns from config into renderBoardTui and filter the projected columns at the render boundary; keep move mode showing every column so all drop targets stay reachable, and keep currentStatuses derived from the unfiltered projection so hiding cannot narrow move targets.
5. Apply the same filter to the non-TTY (piped) board output so both render paths in src/ui/board.ts agree.
6. Footer decision: do not add a [H] hint to the default footer (it is already 150 visible chars and wraps to two lines at common widths). Document the key in the help popup only, and confirm each toggle with the existing transient footer message.
7. Add tests: the contributor's pure-helper tests plus TUI render tests (hidden on/off, move mode restores empty columns, S-h toggle persists to config) and a piped-output test.
8. Verify bunx tsc --noEmit, bun run check ., and the full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Takeover of https://github.com/MrLesk/Backlog.md/pull/808 by János Mikó (@janosmiko).

Precedence check: hideEmptyColumns already exists in BacklogConfig and has been shipped since BACK-522, but only the browser board read it. The contributor did not invent a second mechanism - his TUI hotkey writes that same config key - so there was no conflicting-mechanism product call to escalate, and this change is 'make the TUI honor the existing key' plus his quick toggle.

Shipped (TUI only): the contributor's pure filterVisibleColumns helper, the hideEmptyColumns option threaded from config into renderBoardTui, the Shift+H toggle that persists to the shared config key, and a help-popup entry. Adapted to the board rework: the toggle now resolves Core through getCore() instead of constructing one from process.cwd() (so BACKLOG_CWD and the caller's project root are respected), the two view entry points his patch touched no longer exist, and currentStatuses is now derived from the unfiltered projection inside renderView (rebuildColumns used to derive it from the rendered columns, which would have narrowed the move targets once columns were hidden).

Footer decision (owner constraint): no [H] hint was added. The default footer is already 150 visible characters and wraps to two lines at 100 columns, so the hotkey is documented in the help popup instead, and each toggle confirms itself through the existing transient footer message. The footer string is byte-identical to main.

Not shipped from PR #808: the browser board toolbar button, the drag-and-drop hardening, the README copy and the bundled BACK-555 task-composer commits, all outside this task's acceptance criteria. Worth noting for a separate decision: his drag-and-drop findings describe a live defect in the already-shipped web behavior - Board.tsx flips isDragging synchronously inside dragstart, which re-inserts the hidden columns during the drag and (per his report) cancels the native drag in Chromium, making cards undraggable while hideEmptyColumns is on.

Piped board: the non-TTY branch of renderBoardTui now applies the same filter, so 'backlog board' means the same thing with and without a TTY. 'backlog board export' was deliberately left alone - it writes a full snapshot artifact.

Review follow-up (Codex P2 threads on PR #889):

1. Shutdown race, confirmed and fixed. The Shift+H handler is async but the key emitter does not await it, so quitting right after the toggle resolved the board while getCore()/loadConfig()/saveConfig() were still in flight, and unified-view's process.exit(0) dropped the write. Reproduced with a red test that delays saveConfig by 300ms: the board resolved with hide_empty_columns still unset. The in-flight boolean guard is now the pending promise itself (pendingSettingWrite), and a new closeBoard() helper awaits it before clearing the footer timer, destroying the screen and resolving. closeBoard also replaced the duplicated teardown in the q, Esc, Tab and view-switcher paths, so a handoff to the task list cannot drop the write either. No UI copy was added.

2. Milestone-grouped piped board, fixed. The non-TTY --milestones branch bypassed the filter and still printed '### <status> (0)' headings per milestone. The visible statuses are now derived once before the milestone branch and passed to both generators, matching the browser, whose milestone lanes hide a status that is empty across all lanes.

Verified: bunx tsc --noEmit clean, bun run check . clean across 369 files, 14 tests in board-hide-empty-columns.test.ts (2 new, both red before the fixes), 115 tests across the 9 board/TUI files, full bun run test 2164 pass / 6 skip / 0 fail. Live tmux run: pressing H then q back to back with no pause left hide_empty_columns: true in config.yml, and 'backlog board --milestones' piped drops the In Progress heading with the setting on and keeps it with the setting off.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI board now honors the shared hideEmptyColumns setting and adds Shift+H to flip it, taken over from PR #808 by János Mikó with his commit authorship preserved. Empty status columns disappear when the setting is on, every column returns while a task is being moved so all drop targets stay reachable, the piped board output applies the same filter, and the setting persists to the same config key the browser board and 'backlog config' already use. The footer was left untouched (the hotkey is documented in the help popup) so it does not get more crowded. Verified with 11 tests in src/test/board-hide-empty-columns.test.ts covering the helper, the rendered TUI columns with the setting on and off, the move-mode restore, the Shift+H round trip through config.yml, and both piped outputs; plus a live tmux run of 'backlog board' at 100x32 where In Progress was hidden, Shift+H restored it with the 'Showing empty columns' message and wrote hideEmptyColumns: false, the help popup listed the shortcut and the footer stayed at its unchanged two lines. bunx tsc --noEmit clean, bun run check . clean across 369 files, full bun run test 2161 pass / 6 skip / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
