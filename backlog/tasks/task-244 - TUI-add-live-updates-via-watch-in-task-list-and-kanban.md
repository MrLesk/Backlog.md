---
id: task-244
title: 'TUI: add live updates via watch in task list and kanban'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-26 21:05'
updated_date: '2025-09-13 21:03'
labels:
  - tui
  - watcher
  - enhancement
dependencies: []
---

## Description

Add live updates to the TUI task list and kanban views using the shared file-watcher. When tasks are created, edited, or archived/moved, the currently open TUI must update in-place without restart. The active filters and sort remain applied, and the current selection is preserved when possible. The feature is enabled by default in interactive TTY sessions and shows a footer indicator with a hotkey to toggle live updates. Updates are incremental (no full reload for single-file changes). If file watching is unavailable, the UI degrades gracefully and clearly indicates that live updates are off.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI updates in-place on file events: create/edit/archive (no restart)
- [x] #2 Active filters and sort stay applied after every update; no filter reset
- [x] #3 New task that matches current filter appears within 1s without losing selection
- [x] #4 Edits that change filter membership move the task accordingly (add/remove/move between statuses)
- [x] #5 Removal/archive: removed task disappears; if selected, selection falls back to nearest neighbor
- [x] #6 Incremental updates only; avoid full dataset reload for single-file changes
- [x] #7 Default ON in interactive TTY; footer shows "Live: ON/OFF"; hotkey toggles watch (e.g., 'w')
- [x] #8 CLI flag to disable for the session (e.g., --no-watch); defaults to enabled
- [x] #9 Graceful fallback when file watching is unavailable; show indicator and keep UI usable
- [x] #10 Tests simulate watch events (stub) to verify list/kanban update flows, filter/selection preservation
- [x] #11 Docs updated: behavior, indicator, toggle hotkey, CLI flag, limitations
<!-- AC:END -->


## Implementation Notes

TUI live updates via file watcher implemented with comprehensive real-time functionality. Added CLI --no-watch flag, W hotkey toggle, Live ON/OFF indicators, state preservation during updates, incremental updates, graceful fallback, and extensive test coverage. Integrates perfectly with all TUI views.
