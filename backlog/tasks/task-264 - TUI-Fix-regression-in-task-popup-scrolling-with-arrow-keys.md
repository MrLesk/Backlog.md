---
id: task-264
title: 'TUI: Fix regression in task popup scrolling with arrow keys'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-12 20:42'
updated_date: '2025-09-12 21:04'
labels:
  - bug
  - tui
  - regression
dependencies: []
priority: high
---

## Description

There is a regression in the task popup in the TUI where scrolling with up and down arrows doesn't work anymore. The esc button works for closing the popup, but arrow key scrolling is broken. The scrolling works fine in the task detail view of the task list, so the issue is specifically with the popup.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Up arrow key scrolls content up in task popup
- [x] #2 Down arrow key scrolls content down in task popup
- [x] #3 Esc key still closes the popup
- [x] #4 Scrolling behavior matches task detail view
- [ ] #5 No regression in other TUI functionality
<!-- AC:END -->


## Implementation Plan

1. Reproduce popup scrolling issue on Kanban & Sequences
2. Inspect popup code; compare with detail pane
3. Replace box with scrollabletext in popup content area
4. Verify keys: Up/Down/j/k/PageUp/PageDown/Home/End
5. Ensure Esc close still handled; focus returns to list
6. Run tests, typecheck, build
7. Write implementation notes and mark AC


## Implementation Notes

Fix: Restore arrow-key scrolling in TUI task popup.

Changes:
- src/ui/task-viewer.ts: Replace popup content area from box({ scrollable: true }) to scrollabletext({...}) to use built-in scrolling handlers (up/down/j/k/PageUp/PageDown/Home/End).
- src/ui/board.ts: Remove redundant manual up/down handlers and rely on scrollabletext defaults.

Rationale:
- Detail pane already used scrollabletext and still worked. Popup regressed after switching to a plain box, which doesn't reliably handle arrow key scrolling; also avoid double-scroll and any casts.

Verification:
- Build with `bun run build` or run dev CLI.
- Board: `bun run cli board view` → select a task → Enter → popup opens → Up/Down and j/k scroll; Esc closes.
- Sequences: `bun run cli sequences view` → pick a task → Enter → same behavior.
- Non-interactive behavior unchanged; all tests pass.

Tests/Checks:
- `bunx tsc --noEmit` OK
- `bun run check .` OK
- `bun test` OK (all passing)
- `bun run build` OK
