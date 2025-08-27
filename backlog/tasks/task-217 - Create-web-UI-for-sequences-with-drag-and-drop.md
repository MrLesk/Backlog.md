---
id: task-217
title: Create web UI for sequences with drag-and-drop
status: Done
assignee:
  - '@codex'
created_date: '2025-07-27'
updated_date: '2025-08-27 01:06'
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
- [x] #1 Server exposes GET /sequences and POST /sequences/move using computeSequences; updates persisted
- [x] #2 Web page lists sequences clearly using server data
- [x] #3 Users can move tasks within/between sequences; dependencies update via server
- [x] #4 Frontend tests cover rendering and move flows
- [x] #5 Server and UI adopt { unsequenced, sequences } shape; Unsequenced rendered first
- [x] #6 Join semantics in web UI: moving into a sequence sets moved deps to previous sequence only; do not modify other tasks
- [x] #7 Moving to Unsequenced allowed only if task is isolated; show clear error otherwise
<!-- AC:END -->


## Implementation Notes

Completed sequences web UI with tests
