---
id: task-350
title: Fix TUI editor launch leaving terminal keypad mode enabled
status: In Progress
assignee:
  - '@codex'
created_date: '2025-12-22 19:22'
updated_date: '2025-12-22 22:02'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users report that opening an editor from `backlog board` leaves the terminal in a mode where arrow keys are not interpreted correctly inside the editor. Update the board/editor handoff so interactive editors receive normal cursor key input and the TUI returns cleanly after closing the editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening a task from `backlog board` with E allows arrow-key navigation in common terminal editors the same way as launching the editor directly.
- [ ] #2 The board UI restores correctly after the editor exits and continues to accept input.
- [ ] #3 The terminal is not left in an application cursor/keypad mode after launching an editor from the board.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the keypad mode mismatch using a tmux-driven arrow-sequence capture.
2. Update the TUI editor handoff to reset keypad mode before pause and restore it after resume in `Core.openEditor`.
3. Route board edit actions through `Core.openEditor(screen)` to centralize the behavior.
4. Re-run the tmux repro to confirm arrow sequences are normal and the board redraws correctly.

Add a raw escape-sequence fallback to disable/restore application cursor mode when terminfo lacks keypad_local/xmit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repro: run `TERM=screen-256color ARROW_DUMP_FILE=tmp/arrow-board.txt EDITOR=./tmp/arrow-dump.sh bun run cli board` inside tmux, press E then an arrow key. Before fix the sequence captured was `1b4f41` (application mode); after fix it is `1b5b41` (normal mode).
<!-- SECTION:NOTES:END -->
