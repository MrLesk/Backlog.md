---
id: task-215
title: Implement TUI view for sequences
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-07-27'
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

- [ ] Launch an interactive TUI (using blessed) when sequence list command is invoked without --plain flag.
- [ ] Display sequences vertically with tasks formatted as "TASK-{task id} - task title".
- [ ] Navigate up/down between tasks across all sequences using up/down arrow keys, highlighting the current task like in the kanban view.
- [ ] Show a yellow border around the sequence containing the currently highlighted task, similar to kanban board visualization.
- [ ] Press Enter to open task detail popup like in the kanban view, with q/Esc to return to the list.
- [ ] Hold Shift and use arrow keys to move the highlighted task up/down one position at a time.
- [ ] Show visual indicator (extra "-> " prefix and italic font) for the task being moved while Shift is held.
- [ ] When Shift is released, keep the task in its new position. If moved within same sequence, maintain sequence position. If moved to different sequence, update task dependencies and next sequence dependencies accordingly.
- [ ] Implement core functionality to move tasks between sequences: accepts task ID, target sequence, and whether it's creating a new sequence, then sets moved task dependencies to previous sequence and updates next sequence tasks to depend on moved task.
- [ ] Show drop zones between sequences when dragging a task (while Shift is held).
- [ ] Allow creating new sequences by dropping tasks in drop zones between existing sequences or at top/bottom.
- [ ] For any task move (to existing sequence or new sequence via drop zone), use the same logic: set moved task to depend on all tasks from previous sequence, and update all tasks in immediately next sequence to depend on moved task.
- [ ] Implement scrolling for the entire list like in the tasks list view.
- [ ] Allow users to press 'q/esc' to exit the TUI.
- [ ] The TUI should consume the sequences returned by the core compute function (Task 213) and not recalculate them unless a task is moved.
- [ ] Provide integration tests to ensure the TUI renders correctly and handles all navigation, dragging, and dependency update features without crashes.

