---
id: task-215.02
title: 'TUI sequences: navigation and detail view'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-23 19:12'
updated_date: '2025-08-24 15:08'
labels:
  - sequences
dependencies: []
parent_task_id: task-215
---

## Description

Support keyboard navigation across sequences and tasks, and opening task detail view consistent with existing TUI patterns.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Arrow keys navigate across tasks and sequences
- [x] #2 Selection highlight clearly indicates current task
- [x] #3 Enter opens a detail popup; Esc closes the popup; Esc (when no popup) quits sequences
<!-- AC:END -->

## Implementation Plan

1. Enhance TUI to support arrow-key navigation across all sequence tasks.
2. Highlight current task line; keep it in view while scrolling.
3. On Enter, open task detail using existing viewer, then return to sequences.
4. Wire CLI interactive path to pass core for loading detail content.
5. Type-check and run tests; keep notes concise (no duplicate headers).

## Implementation Notes

Added navigation and detail:
- Up/Down (and j/k) to move selection; highlighted with inverse style.
- Keeps selection in view by adjusting container scroll.
- Enter destroys TUI screen, opens task detail via viewTaskEnhanced, then rebuilds sequences view.
- CLI passes core to the TUI for resolving file path and content.
- Exit with q/Esc; plain output unaffected.

Adjusted Enter action to open a Kanban-style detail popup instead of switching to the full task list view. Popup closes with q/Esc and returns focus to the sequences view.

Changed Esc to close only the popup. Updated footer hint and removed global Esc to quit. Quit remains on q/C-c.

Finalized behavior:
- Popup opens with Enter; Esc closes only the popup; Esc again (no popup) quits sequences.
- Footer updated accordingly.
- Navigation disabled while popup is open.
