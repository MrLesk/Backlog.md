---
id: BACK-273.06
title: '273.06: Web UI on centralized search'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-19 18:34'
updated_date: '2025-09-21 21:35'
labels:
  - web
  - search
  - ui
dependencies: []
parent_task_id: task-273
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the React app to consume search results from the new API/store, remove local Fuse usage, and add the search field plus status/priority dropdowns to the task list header with shared filter behavior and highlight links preserved.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sidebar and All Tasks list load data via the centralized API/search service without any in-browser Fuse index.
- [x] #2 Task list header displays a shared search input plus status and priority dropdowns wired to the centralized search/filter API.
- [x] #3 Dropdown filters reuse the same status and priority values as CLI/TUI and support combined filtering alongside search.
- [x] #4 Filter state (search, status, priority) persists when navigating between task details and returning to the All Tasks view.
- [x] #5 Filter changes update the URL query parameters so filtered views remain bookmarkable.
- [x] #6 Interface exposes a clear/reset control that removes all active search and filter inputs.
- [x] #7 All Tasks view displays a 'Showing X of Y tasks' style count while preserving highlight and deep-link behavior from search results.
- [x] #8 bun run check ., bunx tsc --noEmit, and bun test cover the updated components.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Web app loads tasks/documents/decisions via the centralized search snapshot (replaces direct REST loaders).
- All Tasks view now calls /api/search for search/status/priority filtering with URL sync, counts, and clear/reset controls.
- Sidebar search uses the shared search API (no in-browser Fuse) with debounce, loading, and empty/error states.
- Tests: bun run check ., bunx tsc --noEmit, bun test.
<!-- SECTION:NOTES:END -->
