---
id: task-214
title: Add CLI command to list sequences (plain and interactive)
status: Done
assignee:
  - '@claude'
created_date: '2025-07-27'
updated_date: '2025-07-27'
labels:
  - sequences
  - cli
dependencies:
  - task-213
---

## Description

Provide a way to inspect computed sequences via the command line. AI agents need a plain-text output, while human users benefit from an interactive TUI. This command should build on the core compute function from Task 213 and not duplicate logic.

## Acceptance Criteria

- [x] Introduce a backlog sequence list command (or similar) to list sequences from tasks in the current backlog.
- [x] When invoked with --plain, output sequences in a machine-readable plain format: list each sequence with its index and the ID/title of each task.
- [x] When invoked without --plain, launch an interactive TUI (using blessed) that displays sequences vertically and allows scrolling through tasks. Users can press q to exit.
- [x] Reuse the core sequence function from Task 213; do not compute sequences separately in the CLI.
- [x] Provide help text in the CLI explaining usage and flags.
- [x] Add tests verifying that the plain output matches expected formats and that the TUI view launches correctly.

## Implementation Plan

1. Analyze CLI command structure
   - Review src/cli.ts to understand command registration
   - Check existing list commands for patterns
   - Understand how --plain flag is handled

2. Create sequence command module
   - Create src/commands/sequence.ts
   - Import computeSequences from core/sequences
   - Load all tasks using existing task loading logic

3. Implement plain output format
   - List sequences with their numbers
   - Show task IDs and titles for each sequence
   - Format output similar to existing plain task list

4. Implement interactive TUI using blessed
   - Create src/ui/sequences-tui.ts for TUI logic
   - Display sequences as vertical sections
   - Add keyboard navigation (up/down, q to quit)
   - Show task details in each sequence

5. Register command in CLI
   - Add 'sequence list' command to main CLI
   - Handle --plain flag to switch between outputs
   - Add help text and documentation

6. Write tests
   - Test plain output format
   - Test TUI initialization
   - Test integration with computeSequences

## Implementation Notes

Successfully implemented the CLI command for listing sequences:

**Approach taken:**
- Created a modular command structure following existing patterns
- Separated concerns between command handling, plain output, and TUI display
- Used the computeSequences function from task-213 without duplication

**Features implemented:**
- Added `backlog sequence list` command with --plain flag support
- Plain output displays sequences with task IDs, titles, and priority indicators
- Interactive TUI using blessed library with full keyboard navigation
- Navigation supports arrow keys, vim keys (h/j/k/l), and Enter to view task details

**Technical decisions:**
- Created separate modules for command logic and TUI to maintain separation of concerns
- Followed existing CLI patterns for consistency
- Used blessed library for TUI (consistent with other TUI views in the project)
- Implemented comprehensive keyboard navigation including sequence-aware left/right movement

**Modified/added files:**
- `src/commands/sequence.ts` - Command handler and plain output logic
- `src/ui/sequences-tui.ts` - Interactive TUI implementation
- `src/commands/sequence.test.ts` - Unit tests for the command
- `src/cli.ts` - Added sequence command registration

All tests pass and the command integrates seamlessly with the existing CLI structure.

Implemented CLI command with plain and interactive TUI modes, full test coverage
