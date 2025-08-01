---
id: task-213
title: Compute sequences from task dependencies
status: To Do
assignee: []
created_date: '2025-07-27'
updated_date: '2025-07-27'
labels:
  - sequences
  - core
dependencies: []
---

## Description

Introduce core logic to compute sequences (parallelizable groups of tasks) solely from existing task dependencies. This will allow the CLI, TUI, and web interfaces to show which tasks can be worked on in parallel without adding any new task properties.

## Acceptance Criteria

- [ ] Add a pure function (e.g., computeSequences(tasks: Task[]) → Sequence[]) that takes all tasks and returns an ordered list of sequences. Each sequence contains tasks whose dependencies are satisfied by earlier sequences.
- [ ] Sequence 1 contains all tasks with no dependencies; subsequent sequences contain tasks whose dependencies appear in earlier sequences.
- [ ] Tasks with no dependencies between them are grouped into the same sequence.
- [ ] Sequence numbering starts at 1 and increases monotonically; every task appears exactly once.
- [ ] Provide an appropriate Sequence type/interface and export it so it can be reused by CLI, TUI and web layers.
- [ ] Add unit tests covering scenarios such as: no dependencies, simple chains, parallel branches and complex graphs.

