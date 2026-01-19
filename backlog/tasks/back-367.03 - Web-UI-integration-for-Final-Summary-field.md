---
id: BACK-367.03
title: Web UI integration for Final Summary field
status: Done
assignee:
  - '@codex'
created_date: '2026-01-18 12:19'
updated_date: '2026-01-19 19:16'
labels:
  - web
  - enhancement
dependencies:
  - BACK-367
documentation:
  - src/web/components/TaskDetailsModal.tsx
parent_task_id: BACK-367
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Scope

Integrate the `finalSummary` field into the Web UI task detail modal and any relevant task views.

**Depends on:** BACK-367 (core infrastructure must be complete first)

### TaskDetailsModal Updates

Add a Final Summary section to `src/web/components/TaskDetailsModal.tsx`:
- Place after Implementation Notes section
- Use markdown editor component (same as used for Description, Plan, Notes)
- Label: "Final Summary"
- Placeholder text: "PR-style summary of what was implemented (write when task is complete)"
- Save changes via the existing task update API

### Display Considerations

- Show Final Summary in read mode with markdown rendering
- In edit mode, provide the same markdown editor experience as other sections
- Only show the section if finalSummary has content (in read mode) or always show in edit mode
- Consider visual distinction (e.g., subtle background or icon) to indicate this is the "completion" summary

### API Integration

The Web UI uses the existing task API endpoints. Ensure:
- Task fetch response includes `finalSummary` field
- Task update request can set `finalSummary` field
- No new API endpoints needed (uses existing PATCH /api/tasks/:id)

### Reference Files

- `src/web/components/TaskDetailsModal.tsx` - Main task detail/edit modal
- `src/web/components/Board.tsx` - Board component (may show summary preview?)
- Look at how Description, Implementation Plan, Implementation Notes sections are rendered
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TaskDetailsModal displays Final Summary section after Implementation Notes
- [x] #2 Final Summary uses markdown editor for editing (consistent with other sections)
- [x] #3 Final Summary renders as markdown in read/view mode
- [x] #4 Changes to Final Summary are saved via task update API
- [x] #5 Empty Final Summary section is handled gracefully (hidden in read mode, shown in edit mode)
- [x] #6 Web UI tests cover Final Summary display and editing where test patterns exist
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Review `src/web/components/TaskDetailsModal.tsx` for Description/Plan/Notes sections and mirror the pattern to add Final Summary after Implementation Notes.
- Ensure task fetch/update payloads include `finalSummary` (check web API types/utilities) and wire state into the save flow.
- Render Final Summary in read mode only when present; always show in edit mode with placeholder text.
- Add/adjust web tests following existing TaskDetailsModal patterns for section rendering and editing.
- Run targeted tests if present (web test files).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Added Final Summary state and editor to TaskDetailsModal, hid section when empty in preview, and wired finalSummary through save payloads and server update/create handlers. Added web UI tests for preview/create rendering.

Tests: bun test src/test/web-task-details-modal-final-summary.test.tsx
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary
Web UI exposes Final Summary for viewing and editing in Task Details.

## Changes
- Added Final Summary editor + preview in the Task Details modal.
- Wired server create/update to accept `finalSummary` and return it.
- Added UI tests to verify editing flow and rendering.

## Testing
- Covered by the project test run in the parent task: `bun test`.
<!-- SECTION:FINAL_SUMMARY:END -->
