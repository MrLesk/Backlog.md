---
id: BACK-466
title: Hide empty status columns on Board when no tasks
status: To Do
assignee: []
created_date: '2026-05-26 03:02'
labels:
  - ui
  - enhancement
dependencies: []
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a board column has no tasks, hide it to reduce clutter. To preserve drag-and-drop usability, empty columns reappear while a task is being dragged so they remain valid drop targets. Add a new `hideEmptyColumns` boolean to `BacklogConfig` (default false) so existing users see no change; opt-in users get the cleaner board. Surface the toggle in the Settings page.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
