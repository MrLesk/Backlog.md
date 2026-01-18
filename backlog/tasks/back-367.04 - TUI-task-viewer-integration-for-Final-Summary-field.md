---
id: BACK-367.04
title: TUI task viewer integration for Final Summary field
status: To Do
assignee: []
created_date: '2026-01-18 12:19'
labels:
  - tui
  - enhancement
dependencies:
  - BACK-367
documentation:
  - src/ui/tui.ts
parent_task_id: BACK-367
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Scope

Integrate the `finalSummary` field into the terminal UI (TUI) task viewer.

**Depends on:** BACK-367 (core infrastructure must be complete first)

### TUI Task Viewer

The TUI is built with neo-neo-bblessed and displays task details in an interactive terminal interface.

**Updates needed:**
- Display Final Summary section in task detail view
- Place after Implementation Notes section
- Use consistent styling with other sections (heading, content area)
- Only show if finalSummary is non-empty

### Reference Files

- `src/ui/tui.ts` - Main TUI implementation
- Look at how Description, Implementation Plan, Implementation Notes are displayed in the task viewer
- The TUI may use box/text widgets for section display

### Notes

- The TUI is read-only for most fields (editing happens via CLI or external editor)
- Focus on display, not editing
- Scrolling should work correctly with the additional section
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI task viewer displays Final Summary section after Implementation Notes
- [ ] #2 Final Summary section uses consistent styling with other sections
- [ ] #3 Final Summary section only appears when field has content
- [ ] #4 Scrolling works correctly with the additional section content
- [ ] #5 TUI tests cover Final Summary display where test patterns exist
<!-- AC:END -->
