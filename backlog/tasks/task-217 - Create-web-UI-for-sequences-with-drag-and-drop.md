---
id: task-217
title: Create web UI for sequences with drag-and-drop
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-08-26 16:46'
labels:
  - sequences
  - web-ui
  - frontend
dependencies:
  - task-213
---

## Description

Implement sequences in the web UI together with minimal local server endpoints so the feature can be exercised end-to-end. The server acts as a thin bridge to the core sequence computation (task-213); all logic remains in core and UI.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server exposes GET /sequences and POST /sequences/move using computeSequences; updates persisted
- [ ] #2 Web page lists sequences clearly using server data
- [ ] #3 Users can move tasks within/between sequences; dependencies update via server
- [ ] #4 Frontend tests cover rendering and move flows
- [ ] #5 Server and UI adopt { unsequenced, sequences } shape; Unsequenced rendered first
- [ ] #6 Join semantics in web UI: moving into a sequence sets moved deps to previous sequence only; do not modify other tasks
- [ ] #7 Moving to Unsequenced allowed only if task is isolated; show clear error otherwise
<!-- AC:END -->

## Implementation Notes

Align web UI with TUI/CLI: Unsequenced bucket, join semantics, blocked moves to Unsequenced unless isolated. Insert-between drop zones tracked separately.
