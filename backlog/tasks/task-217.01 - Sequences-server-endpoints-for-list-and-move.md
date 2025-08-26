---
id: task-217.01
title: 'Sequences server: endpoints for list and move'
status: To Do
assignee: []
created_date: '2025-08-23 19:13'
updated_date: '2025-08-26 16:46'
labels:
  - sequences
dependencies: []
parent_task_id: task-217
---

## Description

Provide GET /sequences (using computeSequences from task-213) and POST /sequences/move to update dependencies and persist changes.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /sequences returns { unsequenced: Task[], sequences: Sequence[] } (Done excluded)
- [ ] #2 POST /sequences/move applies join semantics: set moved deps to previous sequence; do not modify others; prevent move to Unsequenced unless isolated
- [ ] #3 Input validates task ids/target; returns meaningful errors; updates persisted
<!-- AC:END -->
