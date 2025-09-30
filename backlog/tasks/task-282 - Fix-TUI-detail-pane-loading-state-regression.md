---
id: task-282
title: Fix TUI detail pane loading state regression
status: In Progress
assignee:
  - '@codex'
created_date: '2025-09-29 20:29'
updated_date: '2025-09-30 19:26'
labels:
  - bug
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI task detail pane sometimes displays a persistent “Loading task content…” placeholder even though task data is local. This happens when rapid selection changes cause older read operations to be cancelled via the stale request guard, leaving the shared detailLoading flag stuck at true.

We need to reset the loading flag when a request is superseded so the UI never shows the placeholder indefinitely.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduce the regression and confirm the loading placeholder appears only while content is actually being read.
- [x] #2 Ensure rapid selection changes and filter toggles update the detail pane without leaving stale loading text.
- [x] #3 Add automated coverage or regression test if feasible, or document manual verification steps.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added a pending-load counter so superseded reads clear the loading placeholder only after all requests settle.
- Confirmed the detail pane stops showing the placeholder once file reads finish, even after rapid navigation and filter changes.
- Tests: bun test

- Replaced legacy task viewer with the search-enabled version across the CLI/TUI and exported shared helpers from a single module.

- Restored list↔detail focus handling so borders highlight correctly and left/right navigation works in the enhanced viewer.

- Restored Esc handling in kanban detail popup and auto-focuses the content area so closing works consistently.

- Show an explicit no-results message in the detail pane and suppress stale task details when filters return zero items.

- Fixed Kanban popup focus so arrow/PageUp/PageDown scroll again and the list detail view shows a contextual “no results” message when filters empty the list.

- Reworked pane highlighting to follow blessed focus defaults and kept scrolling keys responsive in both list/detail and kanban popup.
<!-- SECTION:NOTES:END -->
