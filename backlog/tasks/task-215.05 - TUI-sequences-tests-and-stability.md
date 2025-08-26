---
id: task-215.05
title: 'TUI sequences: tests and stability'
status: To Do
assignee: []
created_date: '2025-08-23 19:12'
updated_date: '2025-08-26 16:46'
labels:
  - sequences
dependencies: []
parent_task_id: task-215
---

## Description

Add tests for rendering, navigation, and task moves; ensure no crashes and smooth behavior for large data sets.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unit/integration tests cover rendering and navigation
- [ ] #2 Tests cover move flows and dependency updates
- [ ] #3 No crash or unhandled errors during typical flows
- [ ] #4 Tests cover Unsequenced bucket rendering in TUI and --plain output
- [ ] #5 Tests verify join semantics: moving into a sequence sets moved deps to previous sequence only; other tasks unchanged
- [ ] #6 Tests block moving to Unsequenced when task has deps/dependees; shows clear message
- [ ] #7 Tests ensure moving from Unsequenced to Sequence 1 anchors with ordinal when deps remain empty
<!-- AC:END -->
