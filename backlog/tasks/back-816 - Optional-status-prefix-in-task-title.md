---
id: BACK-816
title: Optional status prefix in task title
status: Done
assignee: []
created_date: '2026-11-20T23:46:00Z'
updated_date: '2026-11-21T01:43:00Z'
labels: []
dependencies: []
ordinal: 415000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teams that browse raw task Markdown in an editor cannot tell a task's status from its title or file name, because status lives only in frontmatter. This must remain opt-in: a default-off config option exposed in web Settings, so no existing user's titles or file names change. Issue #1232.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A default-off config key controls the behavior and is exposed in web Settings
- [x] #2 With the setting off, status changes do not touch the title
- [x] #3 With it on, a browser status change rewrites the leading [status] marker and preserves the rest of the title
- [x] #4 The update covers the detail modal select and save, board drag/multi-move, and board inline edit
- [x] #5 The file name gains the prefix because titles determine file names
- [x] #6 Tests cover the helper and the on/off cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch tasks/back-816-title-status-prefix. Added title_status_prefix config (default off) with Settings toggle, serialization/load and server editable-field support. withStatusPrefix helper strips a leading configured-status marker and prepends the new one while preserving a user's own bracket prefix. Wired into TaskDetailsModal inline update and save, Board.handleTaskUpdate and batch move title updates, via App -> BoardPage -> Board props.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a default-off title_status_prefix option, exposed in web Settings. When enabled, browser status changes rewrite the leading [status] marker of the task title, which also updates the file name; all three status-change paths (detail modal select/save, board drag and multi-move, board inline edit) are covered. Off by default, so no existing title or file name changes. Verified: 101 targeted tests pass across 6 files (including 6 new helper/config tests and 2 new modal integration tests); bun run check:types clean. bun run check has 483 pre-existing diagnostics on this host, none in changed paths.
<!-- SECTION:FINAL_SUMMARY:END -->
