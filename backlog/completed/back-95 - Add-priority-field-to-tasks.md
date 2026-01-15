---
id: BACK-95
title: Add priority field to tasks
status: Done
assignee:
  - '@claude'
created_date: '2025-06-20'
updated_date: '2025-06-20'
labels:
  - enhancement
dependencies: []
---

## Description

Add support for assigning a priority level to each task so that work can be
ordered by importance. The CLI should allow setting the priority when creating
or editing tasks, and the board view should display it.

## Acceptance Criteria

- [x] Tasks support priority metadata
- [x] CLI accepts --priority
- [x] Board shows priority
- [x] Docs updated
- [x] Tests added

## Implementation Plan

1. Update Task type to include priority (high|medium|low)
2. Extend CLI create/edit with `--priority` option
3. Display priority in list and board
4. Update docs and tests

## Implementation Notes

Successfully implemented priority field functionality across the entire Backlog.md codebase:

### Technical Implementation
- **Task Type Definition**: Added optional `priority?: "high" | "medium" | "low"` field to the Task interface in `/src/types/index.ts`
- **CLI Support**: Added `--priority` flag to both `task create` and `task edit` commands with validation for valid priority values (high, medium, low)
- **Markdown Parsing**: Updated `parseTask()` function to parse priority from frontmatter with case-insensitive validation
- **Markdown Serialization**: Updated `serializeTask()` function to include priority field in frontmatter when present
- **Board Display**: Enhanced Kanban board to show priority indicators using colored emojis (🔴 high, 🟡 medium, 🟢 low)
- **Task Viewer**: Updated both interactive and plain-text task views to display priority information

### Files Modified
1. `/src/types/index.ts` - Added priority field to Task interface
2. `/src/cli.ts` - Added --priority flag to create/edit commands with validation
3. `/src/markdown/parser.ts` - Added priority parsing with validation
4. `/src/markdown/serializer.ts` - Added priority serialization
5. `/src/board.ts` - Added priority indicators to board display
6. `/src/ui/task-viewer.ts` - Added priority display to task views
7. `/src/test/priority.test.ts` - Comprehensive test suite for priority functionality

### Key Features
- **Priority Levels**: Three levels supported - high, medium, low
- **Visual Indicators**: Color-coded emoji indicators in board view (🔴🟡🟢)
- **CLI Validation**: Invalid priority values are rejected with helpful error messages
- **Case Insensitive**: Priority values accept mixed case (HIGH, High, high all work)
- **Optional Field**: Priority is optional - existing tasks without priority continue to work
- **Round-trip Support**: Priority values are preserved through parse/serialize cycles

### Testing
Added comprehensive test suite covering:
- Priority parsing from markdown frontmatter
- All valid priority levels (high, medium, low)
- Invalid priority value handling
- Case-insensitive parsing
- Serialization with and without priority
- Round-trip parsing/serialization integrity

All tests pass and linting checks are clean.
