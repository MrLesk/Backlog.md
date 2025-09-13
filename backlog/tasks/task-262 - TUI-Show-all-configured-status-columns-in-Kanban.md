---
id: task-262
title: 'TUI: Show all configured status columns in Kanban'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-07 19:58'
updated_date: '2025-09-13 18:23'
labels:
  - tui
  - board
  - kanban
  - config
  - parity
dependencies: []
priority: medium
---

## Description

Web UI shows all statuses from config as columns in Kanban. The TUI board currently hides empty statuses and only renders columns that have tasks. Update the TUI Kanban to always render every status defined in backlog/config.yml, even when a column has zero tasks, preserving configured order. If tasks use unknown statuses (not in config), show those columns after the configured ones.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI Kanban renders all statuses from backlog/config.yml as columns, even when empty
- [x] #2 Column order matches the order in config.statuses
- [x] #3 Empty columns display with title and (0) count; no crashes when selecting columns with no tasks
- [x] #4 Statuses present on tasks but missing from config appear as extra columns after configured ones
- [x] #5 When there are no tasks at all, the board still renders all configured columns and navigation works
- [x] #6 Web UI behavior unchanged; change applies only to TUI
- [x] #7 Type-check and lint pass; tests cover empty-column rendering and navigation
<!-- AC:END -->


## Implementation Notes

## Summary

Successfully implemented TUI Kanban board to show all configured status columns, matching Web UI behavior.


## Key Changes Made

### 1. Modified Column Display Logic (src/ui/board.ts lines 55-59)
- **Before**: Only showed columns with tasks (`nonEmptyConfigured`)
- **After**: Shows ALL configured statuses first, then unknown statuses with tasks
- **Result**: Empty columns now display with (0) count

### 2. Fixed Column Width Calculation
- Updated to use `displayedStatuses.length` instead of `nonEmptyStatuses.length`
- Ensures proper column distribution across all configured statuses

### 3. Enhanced Navigation Safety
- Added check for empty columns in initial focus setup (lines 177-179)
- Existing navigation already handled empty columns gracefully
- No crashes when navigating through empty columns

### 4. Comprehensive Testing
- Created `src/test/tui-board-columns.test.ts` with 4 test cases:
  - All configured statuses shown even when empty
  - Configured order preserved, unknown statuses at end
  - All columns shown even with zero tasks
  - Case-insensitive status matching works correctly

## Comparison with Web UI

**Web UI (src/web/components/Board.tsx lines 166-177)**:
```typescript
{statuses.map((status) => (
  <TaskColumn title={status} tasks={getTasksByStatus(status)} />
))}
```

**TUI (now matches this behavior)**:
```typescript
const displayedStatuses = [...statuses, ...unknownWithTasks];
```

## Testing Completed

- ✅ Unit tests pass (4/4 scenarios)
- ✅ Biome linting and formatting applied
- ✅ Navigation works in empty columns
- ✅ Column order matches config.statuses
- ✅ Unknown statuses appear after configured ones
- ✅ Zero-task boards show all configured columns

## Impact

TUI now provides full parity with Web UI column display behavior while maintaining backward compatibility with existing navigation and task interaction features.
