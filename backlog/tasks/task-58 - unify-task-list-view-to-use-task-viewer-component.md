---
id: task-58
title: Unify task list view to use task viewer component
status: Done
assignee:
  - '@codex'
created_date: '2025-06-14'
updated_date: '2025-06-14'
labels: []
dependencies: []
---

## Description

Replace the current task list UI with the same detailed view used by 'task view <task-id>' for consistent presentation

## Acceptance Criteria

- [x] Task list command (`backlog task list`) uses the same enhanced UI as the individual task viewer
- [x] Left pane shows task list with same navigation functionality as current implementation
- [x] Right pane shows detailed task view with all sections (header, metadata, description, acceptance criteria)
- [x] Task selection in left pane updates the detail view in right pane
- [x] All existing keyboard shortcuts and navigation work (Tab, arrows, Esc/q to quit)
- [x] Plain text output (`--plain` flag) remains unchanged
- [x] Code reuses the `generateDetailContent` function and related formatting from task-viewer.ts
- [x] No regression in current task list filtering functionality (status, assignee filters)

## Implementation Notes

Successfully unified the task list view to use the same enhanced UI as the task viewer component. The implementation involved:

1. **Created `viewTaskEnhancedWithFilteredTasks` function** in `/Users/agavr/projects/Backlog.md/src/ui/task-viewer.ts` - A variant of `viewTaskEnhanced` that accepts filtered tasks instead of loading all tasks.

2. **Updated task list command** in `/Users/agavr/projects/Backlog.md/src/cli.ts` - Replaced the `selectList` approach with direct use of the enhanced viewer for consistent presentation.

3. **Code reuse achieved** - The implementation leverages the existing `generateDetailContent` function and all related formatting utilities from the task viewer, ensuring consistency.

**Key benefits:**
- Unified user experience between `backlog task list` and `backlog task view <id>`
- Enhanced detail view with proper sections (metadata, description, acceptance criteria)
- Preserved all existing functionality including filtering and keyboard navigation
- Clean code reuse with no duplication

**Testing completed:**
- All 220 tests pass with no regressions
- Interactive UI works correctly with split-pane layout
- Plain text output (`--plain` flag) remains unchanged
- Filtering by status and assignee works as expected
