---
id: task-213
title: Compute sequences from task dependencies
status: Done
assignee:
  - '@claude'
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

- [x] Add a pure function (e.g., computeSequences(tasks: Task[]) → Sequence[]) that takes all tasks and returns an ordered list of sequences. Each sequence contains tasks whose dependencies are satisfied by earlier sequences.
- [x] Sequence 1 contains all tasks with no dependencies; subsequent sequences contain tasks whose dependencies appear in earlier sequences.
- [x] Tasks with no dependencies between them are grouped into the same sequence.
- [x] Sequence numbering starts at 1 and increases monotonically; every task appears exactly once.
- [x] Provide an appropriate Sequence type/interface and export it so it can be reused by CLI, TUI and web layers.
- [x] Add unit tests covering scenarios such as: no dependencies, simple chains, parallel branches and complex graphs.

## Implementation Plan

1. Analyze existing codebase structure
   - Review existing Task interface in src/types/index.ts
   - Understand how dependencies are currently stored and accessed
   - Check existing task loading/parsing logic

2. Design the Sequence interface
   - Create a Sequence type with number and tasks array
   - Ensure type compatibility with existing Task interface

3. Implement computeSequences algorithm
   - Create src/core/sequences.ts module
   - Build dependency graph from all tasks
   - Implement topological sorting with level assignment
   - Group tasks by their computed level (sequence number)
   - Handle circular dependency detection

4. Write comprehensive unit tests
   - Test with no dependencies (all tasks in sequence 1)
   - Test simple linear chains (A→B→C)
   - Test parallel branches (A→B, A→C, then B→D, C→D)
   - Test complex dependency graphs
   - Test circular dependency handling
   - Test with empty task list

5. Export and document the function
   - Export computeSequences and Sequence type
   - Add JSDoc documentation
   - Ensure proper error handling

## Implementation Notes

Successfully implemented the core sequences computation functionality:

**Approach taken:**
- Used Kahn's algorithm with level assignment to compute sequences
- Implemented topological sorting that groups tasks into levels based on their dependencies
- Each sequence represents a set of tasks that can be worked on in parallel

**Features implemented:**
- Created `src/core/sequences.ts` with the `computeSequences` function and `Sequence` interface
- Added proper TypeScript types and JSDoc documentation
- Implemented circular dependency detection with meaningful error messages
- Handles edge cases like empty task lists and non-existent dependencies

**Technical decisions:**
- Used Map data structures for efficient lookups and graph representation
- Ignored dependencies on non-existent tasks to handle partial task sets
- Tasks within sequences are sorted alphabetically by ID for consistent ordering
- Export Sequence type through main types index for easy access by other modules

**Modified/added files:**
- `src/core/sequences.ts` - Core implementation
- `src/core/sequences.test.ts` - Comprehensive test suite
- `src/types/index.ts` - Added Sequence type export

All tests pass and code complies with project linting standards after fixing non-null assertion issues.

Implemented core sequences computation with topological sorting, comprehensive tests, and proper error handling
