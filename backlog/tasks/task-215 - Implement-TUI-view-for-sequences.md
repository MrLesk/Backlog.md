---
id: task-215
title: Implement TUI view for sequences
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-08-26 16:46'
labels:
  - sequences
  - tui
  - ui
dependencies:
  - task-213
  - task-214
---

## Description

Create a dedicated TUI interface for visualising sequences so human users can intuitively see which tasks belong to which sequence. This enhances usability while keeping tasks and implementation details separate.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI sequences view renders read-only using computeSequences (task-213)
- [ ] #2 Keyboard navigation and task detail open behave as in task list/board
- [ ] #3 Move tasks within/between sequences updates dependencies accordingly
- [ ] #4 Create new sequences via drop positions; dependencies updated to maintain correctness
- [ ] #5 Tests cover rendering, navigation, moves, and no-crash behavior
- [ ] #6 TUI shows an Unsequenced bucket (tasks with no deps/dependees/ordinal) before numbered sequences
<!-- AC:END -->

## Implementation Notes

TUI updated to render Unsequenced first; move mode uses join semantics; insert-between via drop zones is tracked in 215.04.
