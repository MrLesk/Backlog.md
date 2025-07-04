---
id: task-41.2
title: 'CLI: bblessed task view'
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

Implement task viewing with bblessed for scrolling and highlighting sections.

## Acceptance Criteria
- [x] Display task details in scrollable window
- [x] Support navigation between sections
- [x] Works on Node and Bun

## Implementation Notes

Implemented task viewing functionality with blessed's scrollable box widget:

### Key Changes:
1. **Added --tui flag**: Extended the existing `task view` command with an optional `--tui` flag
2. **Scrollable Display**: Task details are rendered in a full-screen scrollable box with vi-style navigation
3. **Formatted Content**: Task information is formatted as markdown-style text with proper sections

### Technical Details:
- Modified the task view command handler to check for the `--tui` option
- When enabled, formats task data into a structured text representation including:
  - Title, ID, Status, Assignee, Reporter, Created Date
  - Labels and Parent Task ID (if applicable)
  - Full task description
- Uses the `scrollableViewer()` function to display content in a blessed box widget
- Supports keyboard navigation: arrow keys, j/k for scrolling, q/Escape to exit

### Integration:
- Maintains backward compatibility - without `--tui` flag, uses the original output format
- Falls back to console.log when blessed is unavailable or not in TTY
- The implementation reuses existing task loading logic from the Core module
