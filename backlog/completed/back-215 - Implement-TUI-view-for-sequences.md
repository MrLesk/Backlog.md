---
id: BACK-215
title: Implement TUI view for sequences
status: Done
assignee: []
created_date: '2025-07-27'
updated_date: '2025-08-26 19:45'
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
<!-- AC:BEGIN -->
- [x] #1 TUI sequences view renders read-only using computeSequences (task-213)
- [x] #2 Keyboard navigation and task detail open behave as in task list/board
- [x] #3 Move tasks within/between sequences updates dependencies accordingly
- [x] #4 Create new sequences via drop positions; dependencies updated to maintain correctness
- [x] #5 Tests cover rendering, navigation, moves, and no-crash behavior
- [x] #6 TUI shows an Unsequenced bucket (tasks with no deps/dependees/ordinal) before numbered sequences
<!-- AC:END -->


## Implementation Notes

Summary:
Implemented a complete TUI Sequences view with read-only rendering, keyboard navigation + detail popup, move mode with join semantics, insert-between drop zones, Unsequenced bucket, and a test suite covering rendering, moves, and stability. The CLI plain output remains stable, and the interactive command falls back to text in headless environments.

UX / Keyboard:
- Normal: ↑/↓ navigate, Enter opens detail popup, q quits, Esc closes popup/quit
- Move mode (toggle with m): ↑/↓ choose target (Unsequenced, Sequence N, or Between K and K+1), Enter apply, Esc cancel

Semantics:
- Unsequenced bucket: tasks with no deps, no dependents, and no ordinal; listed before numbered sequences; Done tasks excluded
- Move into a sequence (join): moved task deps = all tasks in previous sequence (N-1); others unchanged
- Insert between K and K+1: moved task deps = all tasks in K; all tasks in K+1 add moved as a dependency
- Move to Unsequenced: allowed only for isolated tasks (no deps, no dependents); otherwise blocked with clear message
- Within a sequence: render respects ordinal ascending, then task id
- From Unsequenced to Sequence 1: if deps remain empty, anchor by assigning ordinal 0

Core changes:
- computeSequences(tasks) returns { unsequenced, sequences } and excludes Unsequenced from layering
- adjustDependenciesForMove(tasks, sequences, movedId, targetIndex): join semantics
- adjustDependenciesForInsertBetween(tasks, sequences, movedId, K): insert-between semantics (update next sequence deps)
- reorderWithinSequence(tasks, sequenceTaskIds, movedId, newIndex): ordinal assignment within a sequence
- canMoveToUnsequenced(tasks, taskId): reusable isolation check for Unsequenced moves

TUI changes:
- src/ui/sequences.ts: blessed-based sequences view; Unsequenced first; bordered blocks per sequence; scrollable container
- Move mode overlays: clear one-line drop zones only between K and K+1 (no top/bottom) with precise highlighting
- Targeted sequence border emphasized (bold yellow) when applicable; drop-zone hover highlights the overlay line only
- Headless fallback and --plain: unchanged, prints friendly text output

CLI integration:
- backlog sequence list: interactive by default; --plain unchanged; headless env falls back to text

Tests (added/covered):
- src/test/sequences-insert-between.test.ts: insert-between behavior and sequence shifting
- src/test/sequences-move.test.ts: join semantics (existing)
- src/test/sequences.test.ts: computeSequences with Unsequenced ordering (existing)
- src/test/cli-sequences-plain.test.ts: plain output and Unsequenced (existing)
- src/test/cli-sequences-interactive-fallback.test.ts: headless fallback (existing)\
- src/test/sequences-reorder.test.ts: within-sequence ordinal (existing)
- src/test/sequences-unsequenced-eligibility.test.ts: canMoveToUnsequenced helper

Quality:
- bun test (no env overrides) passes
- biome check, lint, and format pass
- type checks pass (tsc --noEmit)

Notes:
- No changes to CLI plain output format; compatible with AI parsing
- Interactive view avoids accidental edits; moves are explicit via m → Enter
- Known limitation: borders cannot be physically thicker in terminal; bold + color used as visual emphasis
