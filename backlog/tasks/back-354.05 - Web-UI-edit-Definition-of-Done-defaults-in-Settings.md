---
id: BACK-354.05
title: 'Web UI: edit Definition of Done defaults in Settings'
status: Done
assignee:
  - '@codex'
created_date: '2025-12-28 20:49'
updated_date: '2026-01-17 21:58'
labels: []
dependencies:
  - task-354.01
parent_task_id: BACK-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add UI controls in the Settings page to view and update the project Definition of Done defaults stored in config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings page displays the current `definition_of_done` list with editable items and add/remove controls.
- [x] #2 Saving settings persists updated `definition_of_done` to config via the existing `/api/config` endpoint.
- [x] #3 Canceling settings restores the previously loaded DoD list without saving changes.
- [x] #4 Order of DoD items is preserved as shown in the UI when saved.
- [x] #5 Manual verification steps are noted (save, reload, confirm new items persist).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Add Definition of Done defaults list in Settings with add/remove and order preserved.
2) Save via /api/config; cancel resets to loaded defaults.
3) Note manual verification steps (save, reload, confirm persistence).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Manual verification: update DoD defaults in Settings, Save, reload page to confirm persistence and order, then Cancel to verify reset behavior.
<!-- SECTION:NOTES:END -->
