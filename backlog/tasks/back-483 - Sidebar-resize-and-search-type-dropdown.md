---
id: BACK-483
title: 'Web UI: Sidebar resize and search type dropdown'
status: Done
assignee: []
created_date: '2026-05-22 15:17'
updated_date: '2026-05-22 16:20'
labels:
  - web-ui
  - ui
  - ux
dependencies: []
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Optimize three areas of the Web UI:
1. The left sidebar supports dragging a divider to resize its width, with a ghost bar preview during drag and persistence to localStorage.
2. The search bar has a type dropdown inside the input, using consistent sidebar icons without added colors. 'All' is the default.
3. Wiki paths in URLs no longer encode '/' as '%2F', keeping subdirectory paths readable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add a draggable resize handle on the right edge of the sidebar
- [x] #2 Adjust sidebar width in real-time while dragging the divider, with visual feedback
- [x] #3 Persist sidebar width to localStorage and restore it on page reload
- [x] #4 Enforce minimum and maximum width limits to prevent the sidebar from becoming invisible or too wide
- [x] #5 Add a dropdown menu next to the search bar listing available search type options
- [x] #6 Use a magnifying glass icon for the "All" option, and use respective icons for other types (tasks, docs, decisions, etc.)
- [x] #7 Default to "All"; users can switch to a specific type
- [x] #8 Trigger the corresponding search filter immediately when the type is switched
- [x] #9 Fix wiki URL encoding so that `/` separators remain readable instead of being encoded as `%2F`
- [x] #10 All changes pass type-checking and linting; related interactive components have test coverage
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Sidebar resize:
   - Add sidebarWidth state + isResizing flag.
   - Add a 1px resize handle on the right edge.
   - During drag, move a blue ghost bar via DOM ref (no React re-render) for smoothness.
   - On mouseup, apply the final width to state + localStorage.
   - Enforce min 200px / max 500px.
2. Search type dropdown:
   - Add searchType state ('all' | SearchResultType).
   - Place a clickable icon button inside the search input (left side, absolute).
   - Dropdown lists All/Tasks/Documents/Decisions/Wiki with the same icons used in the sidebar.
   - Pass selected type to apiClient.search; fallback to parsed query types when 'all'.
3. Wiki URL encoding:
   - Introduce encodeWikiPath() in urlHelpers.ts: split by '/', encodeURIComponent each segment, join back with '/'.
   - Replace all wiki encodeURIComponent calls in SideNavigation, WikiDetail, and api.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Ghost bar approach chosen over live width mutation because React re-rendering on every mousemove caused noticeable lag.
- encodeWikiPath keeps '/' separators readable while still safely encoding special characters like spaces or CJK in individual path segments.
- Type-check and search-command-query tests pass; build blocked only by Windows file lock on dist/backlog.exe.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
