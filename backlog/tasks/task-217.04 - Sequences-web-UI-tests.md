---
id: task-217.04
title: 'Sequences web UI: tests'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:13'
updated_date: '2025-08-27 01:06'
labels:
  - sequences
dependencies: []
parent_task_id: task-217
---

## Description

Add tests verifying sequences render correctly and move flows trigger appropriate API calls and UI updates.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rendering tests validate list page behavior
- [x] #2 Move flow tests verify API calls and UI updates
- [x] #3 No regressions in existing UI tests
- [x] #4 Tests cover Unsequenced rendering and sequencing order in the web UI
- [x] #5 Tests cover join semantics and blocked moves to Unsequenced (isolated only)
- [x] #6 No regressions; large datasets scroll smoothly and preserve focus after move
<!-- AC:END -->

## Implementation Notes

Added sequences web UI tests
