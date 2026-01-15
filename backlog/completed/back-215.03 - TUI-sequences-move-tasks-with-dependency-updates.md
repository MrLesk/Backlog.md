---
id: BACK-215.03
title: 'TUI sequences: move tasks with dependency updates'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:12'
updated_date: '2025-08-26 17:58'
labels:
  - sequences
dependencies: []
parent_task_id: task-215
ordinal: 17000
---

## Description

Enable moving tasks within and between sequences using join semantics, and introduce an Unsequenced bucket (tasks with no deps/dependees/ordinal). Moves into sequences anchor via previous-sequence deps (or ordinal for Sequence 1 when needed); moving to Unsequenced is allowed only for isolated tasks.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Visual indicator for moving task ("-> " + highlight) during move mode
- [x] #2 Sequences view excludes Done tasks
- [x] #3 Within-sequence render respects ordinal ordering (then id as tie-breaker)
- [x] #4 Unsequenced bucket appears first (TUI and --plain), listing only tasks with no dependencies and no dependents
- [x] #5 Move mode (m): ↑/↓ choose target (Unsequenced or a sequence), Enter apply, Esc cancel; selected task shows clear visual indicator
- [x] #6 Join semantics: moving into a sequence sets moved task deps to all tasks in the previous sequence; other tasks are not modified
- [x] #7 Moving to Unsequenced is allowed only for isolated tasks (no deps, no dependents); otherwise show a clear message and do not move
<!-- AC:END -->


## Implementation Plan

1. Core helper: adjustDependenciesForMove join semantics (prev sequence deps only)
2. TUI: move mode (m): choose target with ↑/↓ incl. Unsequenced; Enter apply; Esc cancel
3. Persist updates for moved task only; recompute sequences with Unsequenced and rerender
4. Tests: computeSequences with Unsequenced; move join behavior; block moves to Unsequenced when not isolated
5. Ensure Done tasks remain excluded in sequences view

## Implementation Notes

Core: computeSequences returns { unsequenced, sequences }; Unsequenced = no deps, no dependents, no ordinal.
Move semantics (join): set moved deps to previous sequence; exclude self; do not modify other tasks.
Unsequenced → Sequence 1: if deps remain empty, set ordinal to anchor in Sequence 1.
TUI: renders Unsequenced first; move mode selects Unsequenced or numbered sequences; blocks move to Unsequenced unless isolated; clear visual indicators; footer clarifies join behavior.
CLI: --plain prints Unsequenced first, then numbered sequences; blank line between groups.
Tests: updated to cover Unsequenced rendering, join moves, blocked moves to Unsequenced, and ordinal anchoring for Sequence 1.
