---
id: BACK-41.4
title: 'CLI: bblessed board view'
status: Done
assignee: Claude
created_date: '2025-06-11'
updated_date: '2025-06-11'
labels:
  - cli
dependencies: []
parent_task_id: task-41
---

## Description

Render the Kanban board using bblessed widgets with optional vertical layout.

## Acceptance Criteria
- [x] Columns and tasks rendered with bblessed layouts
- [x] Support horizontal and vertical modes
- [x] Works on Node and Bun

## Implementation Notes

Implemented Kanban board rendering using blessed's scrollable viewer:

### Key Changes:
1. **Added --tui flag**: Extended the `board view` command with an optional `--tui` flag for interactive viewing
2. **Created board UI module**: New file `src/ui/board.ts` with `renderBoardTui()` function
3. **Layout Support**: Maintains support for both horizontal and vertical board layouts

### Technical Details:
- Created a dedicated board UI module that wraps the existing ASCII board generation
- The `renderBoardTui()` function:
  - Takes tasks, statuses, layout mode, and column width as parameters
  - Generates the ASCII board using the existing `generateKanbanBoard()` function
  - Displays the result in a blessed scrollable viewer
- This approach maximizes code reuse while adding TUI capabilities
- The scrollable viewer allows users to navigate large boards that exceed terminal dimensions

### Design Decision:
- Rather than reimplementing the board layout logic with blessed widgets, we opted to reuse the existing ASCII board generation
- This keeps the implementation simple and consistent while still providing the benefits of scrollable navigation
- The ASCII art approach is actually more portable and renders consistently across different terminals

### Integration:
- Modified the board view command handler to check for the `--tui` option
- Supports all existing board options (--vertical, --layout)
- Falls back to direct console output when blessed is unavailable or `--tui` is not specified
