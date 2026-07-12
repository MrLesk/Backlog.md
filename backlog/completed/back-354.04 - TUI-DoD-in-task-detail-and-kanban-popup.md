---
id: BACK-354.04
title: 'TUI: DoD in task detail and kanban popup'
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
Show the Definition of Done checklist in TUI task detail views and kanban popups.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI task detail view shows a DoD checklist section with checked/unchecked items.
- [x] #2 TUI kanban task popup includes a DoD section in a readable format.
- [x] #3 DoD rendering is consistent with acceptance criteria presentation when both exist.
- [x] #4 Any existing TUI rendering tests are updated to cover the DoD section.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Render Definition of Done checklist in TUI task detail view.
2) Render DoD section in kanban task popup, aligned with AC formatting.
3) Update any TUI render/snapshot tests or document manual verification.
<!-- SECTION:PLAN:END -->
