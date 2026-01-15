---
id: BACK-180
title: Add statistics overview command to CLI with TUI interface
status: Done
assignee:
  - '@claude'
created_date: '2025-07-12'
updated_date: '2025-07-26'
labels: []
dependencies: []
priority: medium
---

## Description

Create a new backlog overview command that displays project statistics including tasks in progress, priority breakdown, status distribution, and other key metrics using an interactive TUI interface.

## Acceptance Criteria

- [x] Add new overview command to CLI (backlog overview)
- [x] Display count of tasks in each status (To Do In Progress Done)
- [x] Show priority breakdown (High Medium Low None)
- [x] Display total task count and completion percentage
- [x] Show recent activity (recently created/updated tasks)
- [x] Use interactive TUI interface with proper formatting
- [x] Include navigation between different stat views
- [x] Handle empty project state gracefully
- [x] Add command to help documentation
- [x] Update README with overview command usage

## Implementation Plan

1. Add 'overview' command to CLI parser in cli.ts
2. Create src/commands/overview.ts for the command implementation
3. Create src/core/statistics.ts with calculation functions:
   - getTaskStatistics() - counts by status, priority, completion percentage
   - getRecentActivity() - recently created/updated tasks
   - getProjectHealth() - average task age, blocked tasks
4. Create src/ui/overview-tui.ts for the TUI interface:
   - Main dashboard view with all statistics
   - Tab navigation between sections  
   - Keyboard shortcuts (q=quit, h=help, arrows=navigate)
   - Color coding for priorities/statuses
   - Responsive layout
5. Handle edge cases (no tasks, empty priorities)
6. Update CLI help documentation
7. Update README.md with overview command usage
8. Write tests in src/test/statistics.test.ts
9. Run linting and build checks
## Implementation Notes

STATISTICS TO DISPLAY:
Status Overview:
- To Do: X tasks
- In Progress: X tasks  
- Done: X tasks (Y% complete)
- Total: X tasks

Priority Breakdown:
- High: X tasks
- Medium: X tasks
- Low: X tasks
- None: X tasks

Recent Activity:
- Recently created (last 7 days)
- Recently updated (last 7 days)
- Most active status transitions

Project Health:
- Completion rate trend
- Average task age
- Blocked/stale tasks

TUI INTERFACE:
- Main dashboard view
- Tab navigation between sections
- Scrollable lists for detailed breakdowns
- Keyboard shortcuts (q=quit h=help arrows=navigate)
- Responsive layout for terminal size
- Color coding for different priorities/statuses

TECHNICAL APPROACH:
- Reuse existing task loading logic
- Add statistics calculation utilities
- Use blessed/bblessed for TUI rendering
- Follow existing TUI patterns from board view
- Cache calculations for performance

IMPLEMENTATION COMPLETED:
- Added 'overview' command to CLI in cli.ts
- Created src/commands/overview.ts for command logic
- Created src/core/statistics.ts with comprehensive statistics calculations
- Created src/ui/overview-tui.ts with interactive TUI interface
- Added keyboard navigation (Tab/Shift+Tab, number keys, arrows)
- Added help dialog (h key)
- Handles edge cases like empty projects and no tasks
- Falls back to plain text output when not in TTY
- Added tests in src/test/statistics.test.ts (all passing)
- Updated README.md with overview command documentation
- Successfully tested both interactive TUI and plain text modes

## Performance Optimizations Added

- Implemented cross-branch checking optimization that only checks branches with recent activity
- Added `checkActiveBranches` and `activeBranchDays` configuration options
- Default `activeBranchDays: 30` provides good balance between accuracy and performance
- Added `listRecentBranches()` method to git operations for efficient branch filtering
- Added timing information to loading screen for performance debugging
- Optimization applies to all commands that load tasks (overview, board, etc.)
- Users can set lower values (e.g., 7 days) for better performance on repos with many branches
- Properly respects `remoteOperations` config when checking branches
