---
id: task-215
title: Implement TUI view for sequences
status: Done
assignee:
  - '@claude'
created_date: '2025-07-27'
updated_date: '2025-07-27'
labels:
  - sequences
  - tui
  - ui
dependencies:
  - task-213
  - task-214
---

## Description

Create a dedicated TUI interface for visualising sequences so human users can intuitively see which tasks belong to which sequence. This enhances usability while keeping tasks and implementation details separate.

## Acceptance Criteria

- [x] Add a new TUI screen (or reuse an existing layout) that displays sequences as vertical columns with tasks listed underneath each sequence number.
- [x] The TUI should consume the sequences returned by the core compute function (Task 213) and not recalculate them.
- [x] Users can navigate up/down between sequences and tasks using keyboard controls; there should be clear instructions for navigation.
- [x] The layout must handle long task lists gracefully (e.g., by allowing scrolling) and should include IDs and titles for each task.
- [x] Provide integration tests to ensure the TUI renders correctly and handles navigation without crashes.

## Implementation Plan

1. Analyze current TUI implementation\n   - Review sequences-tui.ts from task-214\n   - Identify gaps or improvements needed\n   - Consider if 'vertical columns' means side-by-side layout\n\n2. Enhance TUI layout if needed\n   - Evaluate if current vertical stacked layout is sufficient\n   - Consider implementing side-by-side column view\n   - Add visual separators between sequences\n\n3. Improve navigation features\n   - Add page up/down for faster navigation\n   - Add home/end keys to jump to first/last sequence\n   - Consider adding sequence number shortcuts (1-9)\n\n4. Add visual enhancements\n   - Color-code sequences for better distinction\n   - Add progress indicators showing completed tasks\n   - Show dependencies between tasks visually\n\n5. Integration testing\n   - Create integration tests for TUI rendering\n   - Test navigation edge cases\n   - Verify handling of empty sequences

## Implementation Notes

### What was implemented:

1. **Created `src/ui/sequences-columns-tui.ts`** - A new column-based TUI view that displays sequences side-by-side like a Kanban board
   - Shows up to 6 sequences in columns (with scrollbar for tasks within each column)
   - Each column shows sequence number and task count in the header
   - Tasks display with priority indicators and status colors

2. **Enhanced navigation features:**
   - Arrow keys (←/→) or vim keys (h/l) to navigate between columns
   - Arrow keys (↑/↓) or vim keys (j/k) to navigate tasks within a column
   - Page Up/Down for faster navigation within columns
   - Home/End keys to jump to first/last task in a column
   - Number keys (1-9) as shortcuts to jump directly to sequences
   - Tab key support for potential view switching
   - Enter/e keys to edit tasks directly

3. **Visual enhancements:**
   - Column borders highlight in cyan when focused
   - Task selection highlights in cyan with bold text
   - Priority indicators with color coding (red=high, yellow=medium, green=low)
   - Status colors for task IDs
   - Information popup (i key) showing all sequences overview
   - Scrollbars for long task lists

4. **Integration with CLI:**
   - Updated `src/commands/sequence.ts` to use the column-based TUI by default
   - Maintains plain text output with `--plain` flag
   - Falls back to plain text when not in TTY environment

5. **Created comprehensive tests:**
   - `src/ui/sequences-columns-tui.test.ts` with integration tests
   - Tests for empty sequences, large numbers of sequences, and edge cases
   - Tests verify plain text fallback behavior
   - All tests passing

### Key decisions:
- Chose column-based layout over vertical stacked layout for better visualization
- Limited to 6 visible columns to ensure readability on standard terminals
- Integrated with existing TUI patterns from board.ts for consistency
- Used blessed library for robust terminal UI handling
