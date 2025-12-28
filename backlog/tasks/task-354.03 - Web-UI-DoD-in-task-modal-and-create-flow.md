---
id: task-354.03
title: 'Web UI: DoD in task modal and create flow'
status: To Do
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2025-12-28 20:51'
labels: []
dependencies:
  - task-354.01
  - task-354.05
parent_task_id: task-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a Definition of Done checklist section to the task modal and allow per-task overrides during creation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task modal shows a distinct DoD checklist section with checkboxes, separate from acceptance criteria.
- [ ] #2 Create flow pre-fills DoD defaults and lets users replace, append, or clear the checklist before saving.
- [ ] #3 DoD checklist persists through create and edit via the web API.
- [ ] #4 DoD section presentation is readable and aligned with the existing modal layout.
- [ ] #5 UI verification is covered by existing automated tests or documented manual steps for this change.
<!-- AC:END -->
