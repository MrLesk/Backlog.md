---
id: BACK-447
title: Add No milestone option to TUI milestone filters
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-26 08:41'
updated_date: '2026-04-26 08:48'
labels:
  - tui
  - milestone
  - filter
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/81'
modified_files:
  - src/utils/milestone-filter.ts
  - src/utils/task-search.ts
  - src/ui/components/filter-header.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/board.ts
  - src/test/unified-view-filters.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring the TUI milestone filter UX in line with the Web UI by allowing users to filter for tasks without a milestone assignment. PR #81 is treated as the idea source, but the implementation should build on the current TUI filter header and shared task filtering behavior rather than the stale task-24.1 diff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI task-list milestone picker includes a No milestone option alongside All and active milestones.
- [x] #2 TUI Kanban/board milestone picker includes the same No milestone option and filters tasks consistently.
- [x] #3 No milestone filtering matches tasks with no milestone assignment without breaking existing milestone title/alias filtering.
- [x] #4 The refreshed PR title and task references use the current BACK task ID format.
- [x] #5 Focused automated coverage verifies the filter model and shared TUI filtering behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Treat PR #81 as an idea source and rebuild its branch from current main.
2. Preserve the existing TUI milestone filter implementation and add the missing Web UI parity option for No milestone.
3. Route No milestone through shared task filtering so task list and Kanban use the same behavior.
4. Add focused regression coverage and run full verification before updating the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added shared No milestone milestone-filter constants using the Web UI sentinel value. The TUI task list and Kanban milestone pickers now offer No milestone next to All and active milestones. The filter header renders the user-facing label instead of the sentinel, and shared task filtering now treats the sentinel as tasks with no milestone assignment. Existing title/alias milestone filtering still uses the existing resolver path.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt PR #81 on current main as BACK-447. The stale task-24.1 diff was discarded; the branch now adds Web-parity No milestone filtering to the existing TUI milestone filter UX for both task list and Kanban views, backed by shared filtering tests and full local verification.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
