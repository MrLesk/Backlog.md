---
id: BACK-447
title: Add No milestone option to TUI milestone filters
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-26 08:41'
labels:
  - tui
  - milestone
  - filter
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/81'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring the TUI milestone filter UX in line with the Web UI by allowing users to filter for tasks without a milestone assignment. PR #81 is treated as the idea source, but the implementation should build on the current TUI filter header and shared task filtering behavior rather than the stale task-24.1 diff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI task-list milestone picker includes a No milestone option alongside All and active milestones.
- [ ] #2 TUI Kanban/board milestone picker includes the same No milestone option and filters tasks consistently.
- [ ] #3 No milestone filtering matches tasks with no milestone assignment without breaking existing milestone title/alias filtering.
- [ ] #4 The refreshed PR title and task references use the current BACK task ID format.
- [ ] #5 Focused automated coverage verifies the filter model and shared TUI filtering behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
