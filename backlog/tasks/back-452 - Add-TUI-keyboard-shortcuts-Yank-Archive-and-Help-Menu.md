---
id: BACK-452
title: 'Add TUI keyboard shortcuts: Yank, Complete, Archive, and Help Menu'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-28 12:53'
updated_date: '2026-05-03 11:06'
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
Implemented 'y' to yank task ID, 'c' to complete task, 'a' to archive task with confirmation, and '?' to show a help popup in the TUI board.
- Created `src/utils/clipboard.ts` for cross-platform clipboard support.
- Created `src/ui/components/confirm-popup.ts` for reusable confirmation dialogs.
- Created `src/ui/components/help-popup.ts` for displaying keyboard shortcuts.
- Updated `src/ui/board.ts` and `src/ui/task-viewer-with-search.ts` to include new shortcuts and Help menu.
- Refactored `src/ui/components/filter-popup.ts` to export `createPopupChrome` for reuse.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
