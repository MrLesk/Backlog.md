---
id: BACK-452
title: 'Add TUI keyboard shortcuts: Yank, Complete, Archive, and Help Menu'
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-28 12:53'
updated_date: '2026-05-03 11:38'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement 'y' to yank task ID, 'c' to complete task, 'a' to archive task with confirmation, and '?' to show a help popup in the TUI board.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Yank (y/Y) copies task ID to clipboard with footer notification.
- [x] #2 Complete (c/C) shows confirmation popup and moves task to completed.
- [x] #3 Archive (a/A) shows confirmation popup and archives task on success.
- [x] #4 Help (?) shows popup with all keyboard shortcuts.
- [x] #5 Footer is updated to include [?] Help.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #615 after repairing the contributor branch to a scoped BACK-452 diff, fixing the task-list shortcut state issue, removing an unrelated .gitignore update, and addressing Codex feedback by making the shared help popup show task-list-specific shortcuts when opened from the task viewer. Validation included bunx tsc --noEmit, bun run check ., focused TUI tests, full bun test from the worker pass, green GitHub CI across macOS/Ubuntu/Windows, and Codex no-major-issues approval.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
