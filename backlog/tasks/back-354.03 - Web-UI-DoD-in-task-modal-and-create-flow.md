---
id: BACK-354.03
title: 'Web UI: DoD in task modal and create flow'
status: Done
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2026-01-17 21:58'
labels: []
dependencies:
  - task-354.01
  - task-354.05
parent_task_id: BACK-354
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a Definition of Done checklist section to the task modal and allow per-task overrides during creation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task modal shows a distinct DoD checklist section with checkboxes, separate from acceptance criteria.
- [x] #2 Create flow pre-fills DoD defaults and lets users replace, append, or clear the checklist before saving.
- [x] #3 DoD checklist persists through create and edit via the web API.
- [x] #4 DoD section presentation is readable and aligned with the existing modal layout.
- [x] #5 UI verification is covered by existing automated tests or documented manual steps for this change.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Reuse AcceptanceCriteriaEditor to render DoD section below AC in task modal.
2) Implement create flow with DoD defaults prefill; allow add/remove/check/uncheck and disable defaults (clear).
3) Map DoD changes to API payloads for create/edit; ensure persistence via server handlers.
4) Add/adjust tests or document manual verification steps for the UI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Manual verification: set DoD defaults in Settings, open task create modal to confirm defaults prefill, add/remove items and clear defaults, create task, reopen to confirm DoD persists and toggles update.
<!-- SECTION:NOTES:END -->
