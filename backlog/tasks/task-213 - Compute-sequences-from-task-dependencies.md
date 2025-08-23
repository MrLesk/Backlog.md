---
id: task-213
title: Compute sequences from task dependencies
status: Done
assignee:
  - '@codex'
created_date: '2025-07-27'
updated_date: '2025-08-23 21:13'
labels:
  - sequences
  - core
dependencies: []
---

## Description

Introduce core logic to compute sequences (parallelizable groups of tasks) solely from existing task dependencies. This will allow the CLI, TUI, and web interfaces to show which tasks can be worked on in parallel without adding any new task properties.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add a pure function (e.g., computeSequences(tasks: Task[]) → Sequence[]) that takes all tasks and returns an ordered list of sequences. Each sequence contains tasks whose dependencies are satisfied by earlier sequences.
- [x] #2 Sequence 1 contains all tasks with no dependencies; subsequent sequences contain tasks whose dependencies appear in earlier sequences.
- [x] #3 Tasks with no dependencies between them are grouped into the same sequence.
- [x] #4 Sequence numbering starts at 1 and increases monotonically; every task appears exactly once.
- [x] #5 Provide an appropriate Sequence type/interface and export it so it can be reused by CLI, TUI and web layers.
- [x] #6 Add unit tests covering scenarios such as: no dependencies, simple chains, parallel branches and complex graphs.
<!-- AC:END -->

## Implementation Plan

1. Add Sequence type to src/types/index.ts (index, tasks).
2. Implement computeSequences(tasks) in src/core/sequences.ts using layered topological sort (Kahn):
   - Consider only dependencies within the provided task set (ignore external IDs).
   - Stable ordering within a sequence by task ID.
   - If a cycle remains, emit remaining tasks as a final sequence (deterministic order), to surface in downstream UIs.
3. Add tests in src/test/sequences.test.ts for: no deps, chain, parallel branches, complex graphs, external deps ignored.
4. Keep surface area minimal for reuse by CLI/TUI/web; no UI changes yet.
5. Run test suite and checks; iterate on feedback.

## Implementation Notes

Implemented computeSequences with layered topological sort (Kahn). Added Sequence type and tests covering no-deps, chains, parallel branches, complex graphs, and external-dep ignore. Stable ordering by task ID; cycles emitted as final deterministic layer (surfaced for UIs). All tests pass locally.
