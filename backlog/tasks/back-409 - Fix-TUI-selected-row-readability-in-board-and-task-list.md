---
id: BACK-409
title: Fix TUI selected-row readability in board and task list
status: Done
assignee:
  - '@oz'
created_date: '2026-04-01 09:28'
updated_date: '2026-04-01 09:28'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selected rows in the terminal UI become hard to read in Catppuccin because inline blessed foreground tags override the list widget's selected-row foreground styling. The fix should be limited to TUI selected rows and avoid changing non-selected rendering or web/plain-text behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selected rows in the board view remain readable when item text contains inline blessed foreground color tags
- [x] #2 Selected rows in the task list view remain readable without changing non-selected row formatting
- [x] #3 The fix is covered by focused automated tests and does not change web or plain-text output paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add a small TUI utility that strips blessed foreground color tags while preserving structural tags, then use it only for the actively selected row in board.ts and GenericList so non-selected rows keep their existing rich formatting.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a TUI-only selected-row readability fix by stripping inline blessed foreground tags only for the active row in the board and GenericList paths. Added focused tests for tag stripping and board item preservation, validated the related TUI/task-viewer test suites, ran typecheck, and confirmed the final diff with CodeRabbit.
<!-- SECTION:FINAL_SUMMARY:END -->
