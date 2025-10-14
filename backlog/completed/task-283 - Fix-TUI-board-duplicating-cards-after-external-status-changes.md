---
id: task-283
title: Fix TUI board duplicating cards after external status changes
status: Done
assignee:
  - '@codex'
created_date: '2025-10-03 19:08'
updated_date: '2025-10-03 19:16'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary
Fix the TUI Kanban board so that when task statuses are toggled via CLI while the board is open, columns do not visually show duplicate cards.

## Context
See GitHub issue https://github.com/MrLesk/Backlog.md/issues/383.

## Notes
- Ensure rendering updates fully replace stale list entries.
- Validate against toggling tasks between In Progress and Done while the TUI is open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduce the issue by flipping a task status via CLI while TUI is open and confirm no duplicate cards remain.
- [x] #2 Add automated coverage or a regression script to guard against stale rows.
- [x] #3 Document the fix in the task notes.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Adjusted board refresh logic to trigger a full column rebuild whenever task membership or ordering changes, preventing stale rows from lingering in the TUI.
- Added unit coverage for the new rebuild heuristic to guard regression scenarios.
- Verified fix manually by flipping task statuses while the TUI runs and ran bun run check ., bunx tsc --noEmit, bun test.
<!-- SECTION:NOTES:END -->
