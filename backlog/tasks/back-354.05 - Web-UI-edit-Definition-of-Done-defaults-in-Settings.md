---
id: BACK-354.05
title: 'Web UI: edit Definition of Done defaults in Settings'
status: To Do
assignee:
  - '@codex'
created_date: '2025-12-28 20:49'
labels: []
dependencies:
  - task-354.01
parent_task_id: task-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add UI controls in the Settings page to view and update the project Definition of Done defaults stored in config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Settings page displays the current `definition_of_done` list with editable items and add/remove controls.
- [ ] #2 Saving settings persists updated `definition_of_done` to config via the existing `/api/config` endpoint.
- [ ] #3 Canceling settings restores the previously loaded DoD list without saving changes.
- [ ] #4 Order of DoD items is preserved as shown in the UI when saved.
- [ ] #5 Manual verification steps are noted (save, reload, confirm new items persist).
<!-- AC:END -->
