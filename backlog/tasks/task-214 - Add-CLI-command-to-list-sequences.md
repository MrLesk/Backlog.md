---
id: task-214
title: Add CLI command to list sequences
status: Done
assignee:
  - '@codex'
created_date: '2025-07-27'
updated_date: '2025-08-23 21:53'
labels:
  - sequences
  - cli
dependencies:
  - task-213
---

## Description

Provide a command to inspect computed sequences. The command is interactive by default and supports --plain for machine-readable text output. It must reuse the core computation from task-213 and avoid duplicated logic.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Introduce a \'backlog sequence list\' command; interactive by default; --plain outputs text
- [x] #2 Plain output lists each sequence index and tasks as "task-<id> - <title>"
- [x] #3 Reuse core compute function from task-213; do not duplicate logic in CLI
- [x] #4 CLI help text explains usage and --plain flag
- [x] #5 Tests verify plain output format
<!-- AC:END -->

## Implementation Plan

1. Add CLI group "sequence" with subcommand "list".
2. Reuse computeSequences to compute layered groups from tasks.
3. --plain: print machine-readable output: for each sequence, show "Sequence <n>:" and lines "  task-<id> - <title>".
4. Interactive default: open scrollable viewer with the same grouped content (no special TUI; 215.x will add rich TUI).
5. Provide descriptive help/description for the command and flags.
6. Add tests: create tasks with dependencies and assert plain output formatting.
7. Run tests, lint check; adjust as needed.

## Implementation Notes

Implemented sequence CLI command with interactive default and --plain format. Reused computeSequences, printed sequences deterministically, and added tests asserting plain output. Command help describes usage/flags. All tests pass locally.
