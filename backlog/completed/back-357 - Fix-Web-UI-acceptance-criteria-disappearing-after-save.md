---
id: BACK-357
title: Fix Web UI acceptance criteria disappearing after save
status: Done
assignee:
  - Claude
created_date: '2026-01-01 23:43'
updated_date: '2026-01-02 00:13'
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
Fix implemented in src/web/App.tsx:216-234.

Added useEffect that syncs editingTask with refreshed tasks, but ONLY after
our own save operation (tracked via pendingEditingTaskSyncRef). This prevents
background WebSocket refreshes from overwriting in-progress edits.

Key changes:
- Added pendingEditingTaskSyncRef to track when sync is expected
- handleTaskSaved callback sets ref before calling refreshData
- useEffect only syncs when ref is true, then resets it

Tested via Chrome DevTools MCP:
- Added acceptance criterion to task-345, saved, verified visible
- All tests pass (exit code 0)

Addressed PR feedback: Original fix would have overwritten unsaved edits
during background refreshes. Fixed by only syncing after explicit save.
<!-- SECTION:NOTES:END -->
