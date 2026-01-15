---
id: BACK-215.04
title: 'TUI sequences: create new sequences via drop positions'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:12'
updated_date: '2025-08-26 19:25'
labels:
  - sequences
dependencies: []
parent_task_id: task-215
---

## Description

Allow creating a new sequence by placing a task between existing sequences (top/bottom included) and update dependencies accordingly.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Show drop zones only between numbered sequences (Unsequenced is not a sequence)
- [x] #2 Dropping between Sequence K and K+1 creates a new Sequence K+1 containing the moved task; sequences at and after K+1 shift down by one
- [x] #3 Dependencies updated: moved task depends on prior sequence (K); all tasks in the next sequence depend on the moved task
- [x] #4 Clear visual drop indicators while moving; apply on drop; cancel with Esc
<!-- AC:END -->


## Implementation Plan

1. Core: add insert-between helper updating moved deps and next-sequence deps; handle K=0/K=N; dedup; anchor with ordinal when needed\n2. UI: move mode shows drop zones (Before Seq 1, Between K and K+1, After last); arrows cycle; highlight borders; footer shows target\n3. Apply: Enter applies insert-between via core helper; Unsequenced remains separate; Esc cancels\n4. Recompute: persist changed tasks, recompute sequences, rerender\n5. Edge cases: no sequences (anchor with ordinal), avoid self-deps, idempotent updates\n6. Verify ACs: drop zones visibility, new Sequence K+1 created, deps updated, clear indicators, cancel works

## Implementation Notes

Added insert-between drop zones only between numbered sequences; removed top/bottom zones and Shift shortcuts; implemented overlays with clear labels; fixed highlighting to avoid adjacent sequence highlight; used bold yellow border to emphasize targeted sequence; Enter applies insertion via adjustDependenciesForInsertBetween, Esc cancels; recompute + rerender after apply. Verified with type checks, lint, and tests.
