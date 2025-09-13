---
id: task-244
title: 'TUI: add live updates via watch in task list and kanban'
status: Done
assignee:
  - '@tui-live-agent'
created_date: '2025-08-26 21:05'
updated_date: '2025-09-13 18:39'
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


## Implementation Plan

1. Create WatchManager class to manage file watching across different TUI views
2. Add CLI flag --no-watch to disable watching for session
3. Modify sequences.ts (task list) to integrate live updates with filter/selection preservation
4. Modify board.ts (kanban board) to integrate live updates with column/selection preservation
5. Add footer indicator showing "Live: ON/OFF" status
6. Add hotkey toggle (w or l) to enable/disable watching
7. Implement graceful fallback when file watching unavailable
8. Write comprehensive tests simulating file events
9. Test integration with existing features (filters from task-259, kanban columns from task-262, reordering from task-243)
10. Update CLI entry points to pass watch configuration
11. Ensure incremental updates only - no full dataset reload for single file changes


## Implementation Notes

## Implementation Summary

Successfully implemented live updates for both TUI task list (sequences) and kanban board views. The implementation leverages the existing task-watcher.ts utility and provides a seamless experience with graceful fallbacks.

### Architecture

**WatchManager Class** (`src/ui/watch-manager.ts`)
- Centralized file watching management with toggle support
- Graceful fallback when file watching unavailable
- Footer indicator management (Live: ON/OFF/UNAVAILABLE)
- Cleanup and error handling

**Enhanced Views**
- `src/ui/sequences-with-watch.ts` - Live task list with filter/selection preservation
- `src/ui/board-with-watch.ts` - Live kanban board with column/selection preservation
- Both views preserve state during incremental updates

**CLI Integration**
- Added --no-watch flag to both `board` and `sequence list` commands
- Watch enabled by default in interactive TTY sessions
- Properly integrated with existing unified view system

### Key Features Implemented

1. **Incremental Updates**: No full reload - only affected UI elements update
2. **Selection Preservation**: Selected task maintained across updates by ID tracking
3. **Filter Preservation**: Active filters remain applied after live updates
4. **Nearest Neighbor Selection**: When selected task removed, selects closest remaining task
5. **Hotkey Toggle**: Press 'w' to toggle live updates on/off
6. **Footer Indicators**: Clear status display in footer (Live: ON/OFF/UNAVAILABLE)
7. **Graceful Fallback**: UI remains fully functional when file watching unavailable
8. **Performance**: Updates complete within 1 second as required

### Integration with Recent Features

- **Task 259 (Filters)**: Live updates preserve active status/priority filters
- **Task 262 (Kanban Columns)**: Live updates maintain column structure and focus
- **Task 243 (Reordering)**: Compatible with existing navigation and move modes

### Testing

**Comprehensive Test Suite** (`src/test/tui-live-updates.test.ts`)
- Selection preservation logic
- Filter state maintenance
- Task removal handling with nearest neighbor selection
- Board column state preservation
- Timing constraints verification
- Watch state management
- Footer indicator states

All 8 tests pass, covering critical live update scenarios and edge cases.

### CLI Usage

```bash
# Board with live updates (default)
bun run cli board

# Board without live updates
bun run cli board --no-watch

# Task list with live updates (default)
bun run cli sequence list

# Task list without live updates
bun run cli sequence list --no-watch

# In TUI: Press 'w' to toggle live updates
```

### Performance & Reliability

- Uses existing battle-tested task-watcher.ts utility
- Minimal overhead - only watches when UI active
- Automatic cleanup on TUI exit
- Error isolation prevents crashes
- Incremental updates preserve performance

### Limitations

- File watching dependent on Node.js fs.watch support
- Some file systems may not support watching (handled gracefully)
- Live updates disabled in non-TTY environments (CI/automation)
- Toggle state not persisted across CLI sessions
