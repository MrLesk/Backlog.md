---
id: task-357
title: Fix Web UI acceptance criteria disappearing after save
status: Done
assignee:
  - Claude
created_date: '2026-01-01 23:43'
updated_date: '2026-01-01 23:55'
labels:
  - bug
  - web-ui
  - react
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When adding acceptance criteria in the browser UI and saving, the criteria visually disappears until the task is reopened. The data is saved correctly, but the UI fails to re-render with the updated content.

Related: https://github.com/MrLesk/Backlog.md/issues/467

### Root Cause
In TaskDetailsModal.tsx, after handleSave():
1. setMode("preview") switches to preview mode
2. onSaved() calls refreshData() which fetches all tasks
3. But editingTask in App.tsx is NOT updated (stale reference)
4. The useEffect that resets local state from task prop may reset criteria to stale values

### Fix Strategy
After successful save, update editingTask in the parent (App.tsx) with the refreshed task data so the modal receives the updated task prop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Acceptance criteria remains visible in UI after adding and saving
- [x] #2 Acceptance criteria remains visible in UI after editing and saving
- [x] #3 Acceptance criteria remains visible in UI after removing and saving
- [x] #4 No regressions in other task editing functionality
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add useEffect in App.tsx to sync editingTask with tasks array
2. Trigger sync when tasks change and modal is open
3. Compare object references to avoid infinite loops
4. Test fix using Chrome DevTools MCP
5. Run test suite and commit
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix implemented in src/web/App.tsx:216-225.

Added useEffect that watches [tasks, editingTask, showModal] and syncs editingTask when:
- Modal is open (showModal=true)
- editingTask exists
- A matching task is found in refreshed tasks array
- The found task is a different object reference (prevents infinite loop)

Tested via Chrome DevTools MCP:
- Added acceptance criterion to task-345
- Clicked Save
- Verified criterion remained visible (previously showed "No acceptance criteria")
- Cleaned up test data

All tests pass (exit code 0). Committed as 9a2c43e.
<!-- SECTION:NOTES:END -->
