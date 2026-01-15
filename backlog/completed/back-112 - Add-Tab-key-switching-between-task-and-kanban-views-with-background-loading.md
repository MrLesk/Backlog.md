---
id: BACK-112
title: Add Tab key switching between task and kanban views with background loading
status: Done
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Implement Tab key functionality to switch between task views (list/detail) and kanban board view with intelligent background loading. When users are in task view, the kanban board should load in the background so that pressing Tab provides instant switching. If the kanban board is still loading remote tasks, show the existing loading screen.

## Acceptance Criteria

- [x] Pressing Tab in task list view switches to kanban board
- [x] Pressing Tab in task detail view switches to kanban board  
- [x] Pressing Tab in kanban board switches back to previous task view (list or detail)
- [x] Kanban board starts loading in background when entering task views
- [x] If kanban board is ready, Tab switching is instant
- [x] If kanban board is still loading, show existing loading screen
- [x] Background loading doesn't interfere with current task view performance
- [x] State is preserved when switching between views (selected task, position, etc.)
- [x] Help text shows Tab shortcut in all relevant views
- [x] Memory efficient - avoid keeping duplicate data structures

## Implementation Plan

1. **Background Loading Architecture**
   - Add background loading mechanism for kanban board data
   - Track loading state to determine if instant switch is possible
   - Implement efficient caching to avoid redundant data fetching

2. **Tab Key Handling**
   - Add Tab key listeners to task list view
   - Add Tab key listeners to task detail view
   - Add Tab key listeners to kanban board view (for switching back)
   - Implement view switching logic with state preservation

3. **State Management**
   - Track current view type (task list, task detail, kanban)
   - Preserve selected task when switching views
   - Maintain scroll position and other UI state where appropriate

4. **Loading Integration**
   - Integrate with existing loading screen for remote tasks
   - Handle loading failures gracefully
   - Provide user feedback during background loading

5. **Performance Optimization**
   - Ensure background loading doesn't block UI
   - Implement efficient data sharing between views
   - Add memory management for cached data

6. **Testing**
   - Test switching between all view combinations
   - Test with slow/failed remote task loading
   - Test state preservation across switches
   - Test memory usage and performance impact

## Implementation Notes

**Completed Features:**

1. **View Switcher Architecture** (`src/ui/view-switcher.ts`)
   - Created centralized `ViewSwitcher` class for managing view state and transitions
   - Implemented `BackgroundLoader` for efficient kanban data preloading with 30-second cache TTL
   - Added intelligent background loading that starts when entering task views
   - Memory efficient caching to avoid redundant data fetching

2. **Unified View System** (`src/ui/unified-view.ts`)
   - Created `runUnifiedView()` function as main entry point for all view operations
   - Handles seamless switching between task-list, task-detail, and kanban views
   - Integrates with existing loading screens when background data isn't ready
   - Preserves state and context when switching between views

3. **Enhanced UI Components**
   - **Modified `task-viewer.ts`**: Added Tab key handler for view switching (falls back to old Tab behavior when no view switcher)
   - **Modified `board.ts`**: Added Tab key handler to switch back to task views with selected task context
   - **Updated help text**: Shows "Tab kanban" in task views and "Tab tasks" in kanban view

4. **CLI Integration**
   - Updated `task list` command to use unified view system
   - Updated `task view <id>` command to use unified view system  
   - Updated `board` command to use unified view system
   - All commands now support Tab key switching between views

5. **Background Loading Implementation**
   - Kanban data loads in background when in task views using existing task loading logic
   - Reuses `loadRemoteTasks()`, `resolveTaskConflict()`, and cross-branch task resolution
   - Shows loading screen only when user tries to switch before data is ready
   - Graceful error handling for failed remote task loading

6. **State Management**
   - Tracks current view type (task-list, task-detail, kanban)
   - Preserves selected task when switching between views
   - Maintains task list context and filters
   - Uses callback system to notify view switcher of user navigation

7. **Keyboard Shortcuts**
   - **Tab**: Switch between task views and kanban board
   - **Shift+Tab**: Internal navigation within task views (list ↔ detail)
   - **Existing shortcuts preserved**: E for edit, arrows for navigation, Enter for view, etc.

8. **Testing**
   - Created comprehensive tests for `ViewSwitcher` core functionality
   - Tests cover initialization, state updates, background loading, and callbacks
   - All tests pass successfully

**Technical Decisions:**

- **Backward Compatibility**: Modified existing functions to accept optional view switcher parameter, maintaining existing behavior when not provided
- **Memory Management**: Background loader uses TTL-based cache (30s) and only loads data once per session
- **Error Handling**: Silent fallbacks for git/network errors, graceful degradation when remote tasks unavailable
- **Performance**: Background loading doesn't block UI, uses existing async infrastructure
- **User Experience**: Tab switching is instant when data ready, shows familiar loading screen when not

**All acceptance criteria completed successfully!** ✅

The Tab key now provides seamless switching between task views and kanban board with intelligent background loading for optimal performance.
