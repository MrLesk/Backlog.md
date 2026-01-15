---
id: BACK-319
title: Add move mode keyboard navigation to Kanban board
status: Done
assignee:
  - '@claude'
created_date: '2025-11-19 18:48'
updated_date: '2025-11-19 18:57'
labels:
  - tui
  - kanban
  - keyboard-navigation
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a move mode in the Kanban board view that allows users to reorder tasks and change their status using keyboard navigation. This enhances the TUI experience by providing a quick way to reorganize tasks without switching views or using multiple commands.

The move mode should provide visual feedback, intuitive keyboard controls, and the ability to cancel changes if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing 'm' key toggles move mode on/off
- [x] #2 Current task is visually highlighted when move mode is active
- [x] #3 Up/down arrow keys move the task up and down in its current status column with live reordering
- [x] #4 Left/right arrow keys change the task's status column (To Do ↔ In Progress ↔ Done)
- [x] #5 Pressing 'm' key or 'Enter' confirms the move and persists changes
- [x] #6 Pressing 'Esc' cancels the move and returns task to its original position
- [x] #7 Footer displays instructions for triggering move mode when not active
- [x] #8 Footer displays move mode instructions (arrow keys, confirm, cancel) when move mode is active
- [x] #9 Task position and status changes persist to the task file after confirmation
- [x] #10 Multiple move operations can be performed sequentially without issues
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Approach

This feature adds a move mode to the existing Kanban board TUI (`src/ui/board.ts`) that allows keyboard-driven task reordering and status changes.

## Key Files to Modify

1. **src/ui/board.ts** (primary implementation file)
   - Add move mode state management
   - Implement move mode keyboard handlers
   - Add visual highlighting for move mode
   - Update footer to show context-aware instructions
   - Integrate with Core API for persistence

2. **src/core/backlog.ts** (if needed)
   - Verify existing `reorderTasksInStatus()` method supports our use case
   - Verify `updateTaskFromInput()` can handle status changes

## Implementation Steps

### 1. Add Move Mode State
- Add state variables to track:
  - `moveMode: boolean` - whether move mode is active
  - `movingTaskId: string | undefined` - ID of task being moved
  - `originalColumn: number` - original column index
  - `originalRow: number` - original row index
  - `originalStatus: string` - original status value

### 2. Implement 'm' Key Handler
- Toggle move mode on/off
- When entering move mode:
  - Capture current task ID, column, row, and status
  - Apply visual highlighting to selected task
- When exiting move mode (confirm):
  - Persist changes using Core API
  - Clear move mode state
  - Refresh board display

### 3. Modify Arrow Key Handlers
- Wrap existing up/down handlers to check move mode state
- In move mode:
  - Up/Down: Reorder task within current column (live visual update)
  - Left/Right: Move task to adjacent status column
- Outside move mode: Keep existing navigation behavior

### 4. Add Escape Handler
- Cancel move mode
- Restore task to original position (column + row)
- Clear move mode state without persisting

### 5. Visual Highlighting
- Modify `formatTaskListItem()` or list style to highlight moving task
- Use distinct color/style (e.g., magenta border or background)
- Ensure highlight is visible but not distracting

### 6. Update Footer Instructions
- Replace static footer with dynamic footer function
- Show different instructions based on `moveMode` state:
  - Normal mode: Include "Press 'm' to move task"
  - Move mode: Show "↑↓ Reorder | ←→ Change Status | Enter/m Confirm | Esc Cancel"

### 7. Persistence Logic
- On confirm (Enter or 'm'):
  - If status changed: Use `updateTaskFromInput()` with new status
  - If position changed within same status: Use `reorderTasksInStatus()`
  - If both changed: Update status first, then reorder
- Use `Core.updateTasksBulk()` if multiple tasks need reordering

### 8. Edge Cases
- Handle empty columns during move
- Prevent column navigation beyond bounds
- Handle task disappearing (filtered out) during move
- Ensure popup dialogs don't interfere with move mode

## Testing Strategy

- Manual TUI testing for keyboard interactions
- Verify task file updates persist correctly
- Test edge cases (empty columns, single task, etc.)
- Ensure move mode state cleans up properly on all exit paths
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

Successfully implemented move mode for Kanban board with the following features:

### Core Functionality
- Added move mode state management (moveMode, movingTaskId, originalColumn, originalRow, originalStatus, moveSnapshot)
- Implemented 'm' key handler to toggle move mode on/off
- Modified arrow key handlers:
  - Up/Down: Reorder tasks within current column when in move mode
  - Left/Right: Move task between status columns when in move mode
- Enter key confirms move and persists changes
- Escape key cancels move and restores original position

### Visual Feedback
- Tasks in move mode are highlighted with magenta color and '►' prefix
- Dynamic footer updates to show context-aware instructions:
  - Normal mode: Shows 'M' key to enter move mode
  - Move mode: Shows reorder/change status/confirm/cancel instructions

### Persistence
- Status changes use Core.updateTaskFromInput()
- Position changes use Core.reorderTask()
- Changes are auto-committed to git
- On error, state is restored from snapshot

### Testing
- TypeScript compilation: ✓ Passes
- Full test suite: ✓ Passes (274 tests)
- All edge cases handled (empty columns, bounds checking, etc.)

### Files Modified
- src/ui/board.ts: Added move mode functionality (~150 lines added)
<!-- SECTION:NOTES:END -->
