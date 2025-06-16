---
id: task-75
title: Fix task selection in board view - opens wrong task
status: Done
assignee:
  - '@ai-agent'
created_date: '2025-06-16'
updated_date: '2025-06-16'
labels:
  - bug
  - ui
  - board
dependencies: []
---

## Description

The board view has a bug where clicking on a task sometimes opens the wrong task. This issue affects user navigation and needs to be fixed to ensure proper task selection behavior.

The problem appears to be intermittent, suggesting it might be related to:
- State management issues
- Event handling conflicts
- Indexing problems in the board layout
- Race conditions in the selection logic

## Acceptance Criteria

- [x] Clicking on any task in the board view always opens the correct task
- [x] Task selection is consistent across all board columns
- [x] No race conditions or state conflicts when rapidly clicking tasks
- [x] Selection works correctly after board updates/refreshes
- [x] Test coverage added for task selection logic

## Implementation Plan

1. **Investigate the board view code**
   - Locate the board view component/module
   - Identify the task click handler implementation
   - Find where task IDs are mapped to click events

2. **Debug the issue**
   - Add logging to track which task ID is being selected vs displayed
   - Check for any indexing mismatches between visual position and data array
   - Look for state management issues where task data might be stale

3. **Identify root cause**
   - Check if task IDs are properly bound to click handlers
   - Verify no event bubbling issues
   - Ensure proper cleanup of event listeners
   - Check for any async state updates causing race conditions

4. **Implement fix**
   - Fix the identified issue (likely index mapping or event binding)
   - Ensure task IDs are consistently used throughout the selection flow
   - Add defensive checks to prevent wrong task selection

5. **Testing**
   - Write unit tests for task selection logic
   - Test edge cases: rapid clicks, board refresh during selection
   - Manual testing across different board states

6. **Documentation**
   - Add implementation notes about the fix
   - Document any architectural decisions made

## Implementation Notes

### Root Cause
The bug was caused by an index mismatch between the displayed tasks and the selection handler in `/src/ui/board.ts`:
- Tasks were sorted using `compareIds` for display (line 85)
- But the unsorted task array was stored in the columns object (line 94)
- When a user selected a task, the selection index referred to the sorted position
- This index was used to access the unsorted array, causing the wrong task to be selected

### Solution
Fixed by ensuring the stored tasks array matches the sorted display order:
1. Created a `sortedTasks` variable that contains the sorted tasks
2. Used this same array for both display generation and storage in columns
3. This ensures the selection index always maps to the correct task

### Changes Made
- Modified `/src/ui/board.ts` lines 85-95 to use consistent sorted array
- Added comprehensive tests in `/src/test/board-ui-selection.test.ts`
- Tests verify numeric sorting, selection consistency, and edge cases

### Testing
- Unit tests cover the sorting logic and selection scenarios
- Tests simulate the exact bug scenario and verify the fix
- All existing tests continue to pass
- Code formatting and linting checks pass

### Follow-up Considerations
- The fix is minimal and focused on the specific issue
- No performance impact as we were already sorting for display
- No changes to the UI behavior from user perspective
- Consider adding e2e tests for board interaction in future
