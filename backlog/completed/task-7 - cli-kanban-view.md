---
id: task-7
title: "Kanban Board: Implement CLI Text-Based Kanban Board View"
status: Done
assignee: []
reporter: "@MrLesk"
created_date: 2025-06-04
updated_date: 2025-06-09
completed_date: 2025-06-09
labels: ["cli", "command"]
milestone: m-2
dependencies: ["task-3"]
---

## Description

Design and implement a CLI command (`backlog board view` or similar) that reads tasks from `.backlog/tasks/` and displays them in a simple text-based Kanban board format in the terminal. Columns should be derived from task statuses.

## Acceptance Criteria

- [x] Command parses task files and groups them by status.
- [x] Output is a readable text-based representation of the Kanban board.
- [x] Columns are dynamically generated.

## Implementation Notes

**Core Implementation (src/board.ts):**
- `generateKanbanBoard()` function creates text-based kanban board from task array
- Dynamically groups tasks by status using Map for efficient lookup
- Respects configured status order from project config (`config.yml`)
- Auto-adjusts column widths based on longest content (status name or task title)
- Handles empty task lists by showing configured status columns
- Supports tasks with missing/empty status under "No Status" column

**CLI Integration (src/cli.ts:380-399):**
- Added `backlog board view` command with proper help documentation
- Loads tasks from filesystem and project configuration
- Gracefully handles empty projects with "No tasks found" message
- Integrates with existing Core/FileSystem infrastructure

**Algorithm Features:**
- Column-based layout with proper padding and separators
- Maintains visual alignment with calculated column widths
- Status ordering: configured statuses first, then any unrecognized statuses
- Clean table format: header row, separator line, task rows
- Multi-line task display: task ID on first line, title on second line
- Empty rows between tasks for improved readability
- Screen-friendly format that accommodates long task titles

**Test Coverage (src/test/board.test.ts + src/test/cli.test.ts):**
- Unit tests for core board generation function (5 test cases)
- Integration tests for CLI board command (2 test cases)
- Edge cases: empty tasks, no status, long titles, status ordering
- Comprehensive verification of board structure and content

**Export Integration (src/index.ts:25):**
- Function exported for reuse in other modules
- Follows project's modular architecture pattern

The implementation provides a professional text-based kanban view that works seamlessly with the existing CLI infrastructure and maintains visual consistency across different terminal widths.
