---
id: BACK-227
title: 'Web UI: interactive acceptance criteria editor'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-09 18:39'
updated_date: '2025-09-02 20:56'
labels:
  - web-ui
  - enhancement
dependencies:
  - task-226
---

## Description

In the web UI task popup, provide a dedicated, user-friendly interface for Acceptance Criteria. Acceptance criteria are managed exclusively via the AC editor. Removals are staged and only persisted when the user clicks 'Update Task' (no on-the-fly file writes for removals). The AC editor uses a textarea that starts at one line and grows vertically with content. The Content area should exclude the Acceptance Criteria section to avoid duplication; the AC editor is the single place to view/edit criteria.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Acceptance criteria appear as an editable checklist in the web task popup
- [x] #2 Users can remove a single criterion from the UI without affecting others
- [x] #3 Users can toggle a criterion done/undone from the UI and it persists
- [x] #4 Markdown is updated using checkboxes without reformatting other sections
- [x] #5 Docs and tests updated for UI behaviors
- [x] #6 Removing an acceptance criterion is staged and not written to disk until 'Update Task' is clicked
- [x] #7 Acceptance Criteria editor uses a textarea that starts at one line and auto-grows vertically with content
- [x] #8 The task Content area does not display the Acceptance Criteria section; AC editing happens only in the dedicated editor
<!-- AC:END -->


## Implementation Notes

Implemented auto-growing textarea for Acceptance Criteria editor: rows=1 with auto-resize on input and on mount for existing items; also applied to new criterion input. Refactored parser naming (body vs description), structured AC type rename, and TaskForm sections model.
