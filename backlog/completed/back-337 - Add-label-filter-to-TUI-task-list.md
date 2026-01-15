---
id: BACK-337
title: Add label filter to TUI task list
status: Done
assignee:
  - '@codex'
created_date: '2025-12-06 21:29'
updated_date: '2025-12-06 21:45'
labels:
  - tui
  - filters
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the TUI task list view with a label-based filter so users can narrow tasks by one or more labels. Reuse the existing filtering patterns for status/priority but adapt the UI to select labels and display multiple selections in the limited footer. Keep interaction simple and consistent with current TUI controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A label filter control exists in the TUI task list view, allowing selection of one or more labels from the project’s configured labels or labels present in tasks.
- [x] #2 Filtered results update immediately and combine correctly with existing status/priority filters; filters can be cleared to show all tasks.
- [x] #3 Multiple label selections are presented clearly within the available footer/controls area without cluttering navigation.
- [x] #4 Filter state persists for the current TUI session and resets on exit; existing navigation shortcuts remain unchanged.
- [x] #5 Tests cover label filtering logic and UI handling; lint/type-check pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Review existing filter plumbing (TUI task viewer, in-memory search index, SearchService) to mirror status/priority patterns and find the right insertion points for labels.

Extend filtering logic to accept label arrays (SearchService + createTaskSearchIndex) and surface label filter state in the TUI task list while keeping the UI compact (label picker + footer summary).

Wire label filters into TUI interactions (applyFilters/onFilterChange, hotkeys) and add tests for label filtering logic; run lint/tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation on branch tasks/task-337-label-filter. Reviewing TUI filter plumbing and search utilities to add label filtering while keeping logic reusable for other interfaces.

Added reusable label filter utilities and wired TUI task list to support multi-label filtering with a modal picker, header summary, and label hotkey. Filters combine with status/priority and propagate through onFilterChange state so unified view retains filters during the session.

Extended createTaskSearchIndex and SearchService to honor label filters (intersection), ensuring future interfaces can reuse the same filtering logic.

Tests: new label filter utility tests, task-search label filter tests, search-service label filter coverage; bun run lint and bun test (with Bun 1.2.23) passing.
<!-- SECTION:NOTES:END -->
