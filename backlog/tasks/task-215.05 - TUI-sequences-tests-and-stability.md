---
id: task-215.05
title: 'TUI sequences: tests and stability'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:12'
updated_date: '2025-08-26 19:38'
labels:
  - sequences
dependencies: []
parent_task_id: task-215
---

## Description

Add tests for rendering, navigation, and task moves; ensure no crashes and smooth behavior for large data sets.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unit/integration tests cover rendering and navigation
- [x] #2 Tests cover move flows and dependency updates
- [x] #3 No crash or unhandled errors during typical flows
- [x] #4 Tests cover Unsequenced bucket rendering in TUI and --plain output
- [x] #5 Tests verify join semantics: moving into a sequence sets moved deps to previous sequence only; other tasks unchanged
- [x] #6 Tests block moving to Unsequenced when task has deps/dependees; shows clear message
- [x] #7 Tests ensure moving from Unsequenced to Sequence 1 anchors with ordinal when deps remain empty
<!-- AC:END -->


## Implementation Plan

1. Add core helper to check Unsequenced eligibility; reuse in TUI\n2. Add tests: eligibility, computeSequences coverage, and join/insert moves already present\n3. Add a headless TUI content test for Unsequenced ordering\n4. Run lint/types/tests; fix issues\n5. Mark task Done with notes

## Implementation Notes

Added tests for Unsequenced eligibility and leveraged existing coverage for sequences plain output, headless fallback, join and insert-between moves, and reorder. Introduced canMoveToUnsequenced in core and integrated in TUI to block invalid Unsequenced moves. Verified no crashes, types, and linting; ran full test suite (no env overrides).
