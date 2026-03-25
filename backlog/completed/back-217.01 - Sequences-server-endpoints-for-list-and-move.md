---
id: BACK-217.01
title: 'Sequences server: endpoints for list and move'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:13'
updated_date: '2025-08-26 20:14'
labels:
  - sequences
dependencies: []
parent_task_id: task-217
---

## Description

Provide GET /sequences (using computeSequences from task-213) and POST /sequences/move to update dependencies and persist changes.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /sequences returns { unsequenced: Task[], sequences: Sequence[] } (Done excluded)
- [x] #2 POST /sequences/move applies join semantics: set moved deps to previous sequence; do not modify others; prevent move to Unsequenced unless isolated
- [x] #3 Input validates task ids/target; returns meaningful errors; updates persisted
<!-- AC:END -->


## Implementation Plan

1. Add GET /api/sequences returning {unsequenced, sequences} (Done excluded)\n2. Add POST /api/sequences/move with join semantics and Unsequenced checks\n3. Validate inputs; persist changed tasks; return updated sequences\n4. Keep code aligned with core helpers (computeSequences, adjustDependenciesForMove, canMoveToUnsequenced)\n5. Run lint/types/tests

## Implementation Notes

Implemented sequences endpoints as a thin server bridge to core logic.\n\nEndpoints:\n- GET /sequences and GET /api/sequences → core.listActiveSequences() → { unsequenced, sequences } (Done excluded)\n- POST /sequences/move and POST /api/sequences/move → core.moveTaskInSequences({ taskId, unsequenced?, targetSequenceIndex? })\n\nArchitecture:\n- Server delegates; core owns business rules.\n- Core helpers: planMoveToSequence (join semantics + ordinal anchor on Seq 1), planMoveToUnsequenced (isolation check + clear deps/ordinal).\n- TUI updated to call the same plan helpers, ensuring consistent behavior across UI and API.\n\nValidation & Persistence:\n- Core validates inputs and task existence; server only forwards and returns messages.\n- Bulk updates persisted via core.updateTasksBulk; response includes recomputed sequences.\n\nQuality:\n- Tests pass (bun test); no env overrides.\n- Biome check/lint/format pass; types pass.
