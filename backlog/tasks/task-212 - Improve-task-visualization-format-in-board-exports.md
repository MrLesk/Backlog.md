---
id: task-212
title: Improve board export UI formatting and readability
status: Done
assignee: []
created_date: '2025-07-27'
updated_date: '2025-08-03 10:20'
labels:
  - formatting
  - dx
  - cli
dependencies: []
---

## Description

Update the task display format in board exports to use a cleaner, more scannable format with proper handling of assignees and labels

## Acceptance Criteria

- [x] Task ID displays in bold uppercase format (e.g. **TASK-204**)
- [x] Assignees shown in brackets at the beginning when present
- [x] No 'Assignees: none' text when there are no assignees
- [x] Labels displayed on new line with # prefix and italic formatting
- [x] Labels line omitted entirely when no labels exist
- [x] Format applied consistently to both regular export and README export

## Implementation Notes

Enhanced board export formatting with improved task visualization and readability:

**Core Changes:**
- Updated task formatting logic in `src/board.ts:100-118` to implement new styling rules
- Replaced old format `**task-ID** - Title<br>(Assignees: X, Labels: Y)` with cleaner approach

**Task ID Formatting:**
- Task IDs now display in bold uppercase format: `**TASK-204**` instead of `**task-204**`
- Subtasks maintain prefix: `└─ **TASK-205**` for hierarchical visualization
- Consistent uppercase styling across all export formats

**Assignee Formatting:**
- Assignees displayed in brackets with @ prefix: ` [@alice, @bob]`
- Empty brackets or "none" text eliminated when no assignees present
- Cleaner inline presentation without breaking to new lines

**Label Formatting:**
- Labels moved to dedicated line with # prefix and italic styling: `<br>*#enhancement #ui*`
- Hash prefixes make labels more recognizable and scannable
- Italic formatting provides visual distinction from other text
- Labels section completely omitted when no labels exist (no empty lines)

**Consistency:**
- Single `exportKanbanBoardToFile` function handles both regular exports and README exports
- All formatting rules apply uniformly across export types
- Maintains backwards compatibility with existing export structure

**Testing:**
- Added comprehensive test coverage in `src/test/board.test.ts` for new formatting rules
- Updated existing CLI tests in `src/test/cli.test.ts` to expect uppercase task IDs
- Verified assignee brackets, label formatting, and empty state handling

**Files Modified:**
- `src/board.ts` - core formatting logic implementation
- `src/test/board.test.ts` - new test cases for formatting rules
- `src/test/cli.test.ts` - updated expectations for uppercase task IDs
