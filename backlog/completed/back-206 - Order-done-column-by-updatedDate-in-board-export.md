---
id: BACK-206
title: Order done column by updatedDate in board export
status: Done
assignee: []
created_date: '2025-07-26'
updated_date: '2025-08-03 10:15'
labels:
  - board
  - export
  - sorting
dependencies: []
---

## Description

The backlog board export command should order tasks in the done column by updatedDate (newest first) and then by id as a secondary sort criterion. This ensures the most recently completed tasks appear at the top of the done column.

## Acceptance Criteria

- [x] Done column tasks are sorted by updatedDate in descending order (newest first)
- [x] When tasks have the same updatedDate they are sorted by id in descending order
- [x] Other columns maintain their existing sort order
- [x] Export functionality produces correctly ordered output

## Implementation Notes

Enhanced board export sorting with intelligent column-specific ordering logic:

**Core Sorting Logic:**
- Implemented in `src/board.ts:60-75` within the `generateKanbanBoardWithMetadata` function
- Column-aware sorting: Done column uses updatedDate, others use ID-based sorting

**Done Column Sorting:**
- Primary sort: updatedDate in descending order (newest completed tasks first)
- Secondary sort: ID in descending order when updatedDate is equal or missing
- Uses `new Date(updatedDate).getTime()` for accurate timestamp comparison
- Graceful handling of missing updatedDate values (defaults to 0)

**Other Columns Sorting:**
- Maintains existing ID-based descending sort (`idB - idA`)
- Ensures newest tasks (highest IDs) appear first in To Do and In Progress columns
- Consistent behavior across all non-Done columns

**Test Coverage:**
- Added comprehensive test in `src/test/board.test.ts` for Done column sorting verification
- Tests multiple scenarios: different updatedDates, same dates, missing dates
- Verifies correct ordering in multi-column exports
- Updated test expectations to match new uppercase task ID format

**Key Features:**
- Dual-criteria sorting: updatedDate primary, ID secondary for Done column
- Backward compatibility: no changes to existing column sorting behavior
- Robust handling of edge cases (missing dates, equal timestamps)
- Maintains parent-child task relationships and subtask ordering

**Files Modified:**
- `src/board.ts` - sorting logic implementation
- `src/test/board.test.ts` - test coverage for sorting behavior
