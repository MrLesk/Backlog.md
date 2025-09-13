---
id: task-243
title: Enable TUI task reordering with Shift+Arrow keys
status: Done
assignee:
  - '@tui-reorder-agent'
created_date: '2025-08-24 18:55'
updated_date: '2025-09-13 18:21'
labels:
  - tui
  - ui
  - enhancement
dependencies: []
---

## Description

The TUI task list should support reordering tasks using the same core move functionality available in the web interface. Users can hold Shift to enter move mode and then press the Up/Down arrow keys to reposition the selected task, similar to moving lines in an IDE.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task list view can reorder tasks by calling the existing core reorder function
- [x] #2 Holding Shift toggles move mode and indicates the mode in the UI
- [x] #3 Up and Down arrow keys move the selected task while in move mode
- [x] #4 Task order persists after moving and remains consistent across interfaces
<!-- AC:END -->


## Implementation Plan

1. Analyzed existing TUI task list architecture in unified-view.ts and task-viewer.ts
2. Found that reordering functionality was already implemented in task-viewer.ts using reorderSelected function
3. Discovered that Shift+Arrow key handlers and move mode state management were already implemented
4. Identified missing visual feedback - help bar did not show reordering instructions or move mode indicator
5. Enhanced updateHelpBar function to display "Shift+↑/↓ reorder" instructions and "MOVE MODE" indicator
6. Tested implementation to ensure all acceptance criteria are met
7. Verified type checking, linting, and all existing tests pass


## Implementation Notes

## Task Reordering Implementation Summary

**Core Functionality**: The task reordering feature was already implemented in the TUI via the `reorderSelected` function in `src/ui/task-viewer.ts`, which uses the existing `reorderWithinSequence` core function from `src/core/sequences.ts`.

**Key Implementation Details**:
- **Shift+Arrow Detection**: Key handlers for "S-up" and "S-down" were already bound to trigger move mode and call reorderSelected
- **Move Mode State**: moveMode boolean variable and setMoveMode function manage the temporary state with auto-timeout
- **Visual Feedback Enhancement**: Modified updateHelpBar function to show "Shift+↑/↓ reorder" instructions and highlight "MOVE MODE" when active
- **Core Integration**: Uses existing reorderWithinSequence function with proper ordinal assignment and bulk task updates
- **Order Persistence**: Task ordinals are saved to filesystem via Core.updateTasksBulk, ensuring consistency across TUI and web interfaces

**Files Modified**:
- `src/ui/task-viewer.ts`: Enhanced help bar to display reordering instructions and move mode indicator

**Testing**: All 542 existing tests pass, type checking and linting are clean. The implementation leverages well-tested existing functionality with minimal UI enhancement.
