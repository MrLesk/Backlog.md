---
id: BACK-259
title: Add task list filters for Status and Priority
status: Done
assignee:
  - '@claude'
created_date: '2025-09-06 23:39'
updated_date: '2026-07-04 14:11'
labels:
  - tui
  - filters
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add two filter selectors in the Task List view:

- Status filter: choose from configured statuses (To Do, In Progress, Done or custom)
- Priority filter: choose from high, medium, low

The filters should be accessible from the task list pane and update the list immediately. Keep controls minimal to match the simplified footer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Status filter is available in the task list and lists statuses from backlog/config.yml
- [x] #2 Priority filter is available in the task list and lists: high, medium, low
- [x] #3 Applying a filter updates the task list immediately and can be cleared to show all tasks
- [x] #4 Filters persist during the current TUI session and reset on exit
- [x] #5 Works alongside existing navigation; minimal footer remains uncluttered
- [x] #6 Tests cover filtering logic for status and priority; type-check and lint pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Already implemented on main as of commit d0f3cff; closing with evidence instead of re-implementing. Evidence: src/ui/components/filter-header.ts provides the TUI filter header with status and priority controls (FilterControlId includes status/priority; buttons show 'All' when cleared). src/ui/task-viewer-with-search.ts wires it into the task list: statuses come from config (statuses = config?.statuses || defaults, ~line 217), priority choices are high/medium/low (~line 368), selections call applyFilters() immediately, and the 'All' choice (empty value) clears a filter; filter state is in-memory TUI session state so it resets on exit and coexists with existing navigation. Tests: src/test/filter-header-navigation.test.ts (filter header navigation), src/test/unified-view-filters.test.ts (status/priority filtering logic via createUnifiedViewFilters/applyTaskFilters), src/test/cli-priority-filtering.test.ts. Type-check and lint pass on main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No code change needed: TUI task list already ships status and priority filters (config-driven statuses, high/medium/low priorities, instant apply, clearable via 'All', session-scoped state) with test coverage. Closed as already implemented on main (d0f3cff).
<!-- SECTION:FINAL_SUMMARY:END -->
