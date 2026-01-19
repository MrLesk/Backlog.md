---
id: BACK-367.04
title: TUI task viewer integration for Final Summary field
status: Done
assignee:
  - '@codex'
created_date: '2026-01-18 12:19'
updated_date: '2026-01-19 19:16'
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
- [x] #1 TUI task viewer displays Final Summary section after Implementation Notes
- [x] #2 Final Summary section uses consistent styling with other sections
- [x] #3 Final Summary section only appears when field has content
- [x] #4 Scrolling works correctly with the additional section content
- [x] #5 TUI tests cover Final Summary display where test patterns exist
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Review TUI task viewer section rendering in `src/ui/task-viewer-with-search.ts` (or `src/ui/tui.ts`) and identify where Description/Plan/Notes are added.
- Add Final Summary section after Implementation Notes, using existing heading and content formatting helpers.
- Ensure section is skipped when finalSummary is empty and scrolling continues to work.
- Add TUI tests mirroring existing task viewer tests to assert final summary presence/absence.
- Run targeted tests: `bun test src/test/tui-final-summary.test.ts` (or similar).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Added Final Summary rendering after Implementation Notes in the TUI task viewer and added TUI tests for presence/absence.

Tests: bun test src/test/tui-final-summary.test.ts
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary
TUI task viewer now renders Final Summary below Notes.

## Changes
- Added Final Summary rendering in the task viewer layout.
- Ensured ordering matches CLI/web output.

## Testing
- Covered by the project test run in the parent task: `bun test`.
<!-- SECTION:FINAL_SUMMARY:END -->
