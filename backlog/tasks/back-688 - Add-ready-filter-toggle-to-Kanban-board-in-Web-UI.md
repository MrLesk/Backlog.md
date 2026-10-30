---
id: BACK-688
title: Add ready filter toggle to Kanban board in Web UI
status: Done
assignee:
  - '@antigravity'
created_date: '2026-09-18 12:49'
updated_date: '2026-09-18 13:03'
labels:
  - web
  - enhancement
dependencies: []
type: enhancement
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users cannot filter the Kanban board to actionable tasks ready to be worked on. In BACK-672, readiness was unified in core and exposed on CLI task lists, but the web UI was deferred and GET /api/search omits isReady. Materialize isReady in memory on task records in ContentStore and SearchService so queries remain instantaneous, expose isReady on GET /api/search task results, and add a Ready only filter toggle to the Kanban board.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ContentStore and SearchService attach isReady in memory to tasks without per-query disk I/O
- [x] #2 GET /api/search exposes isReady on task items
- [x] #3 Kanban board filter bar includes a Ready only toggle button matching existing filter styling
- [x] #4 The ready filter syncs with URL search params (ready=true) and clears with Clear filters
- [x] #5 Unit and rendered tests verify the search endpoint and the Kanban ready filter toggle
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server/Store: Attach isReady to in-memory tasks via withReadiness in ContentStore / SearchService so no disk I/O occurs on search queries.
2. Server API: Ensure GET /api/search task items expose isReady.
3. Web Board & BoardPage: Add filterReady state synced to URL search param ?ready=true and a "Ready only" button in the Board filter bar.
4. Verification: Unit tests for server search endpoint isReady and web board filter toggle; run tsc, biome, bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
1. Evaluated readiness computation cost: ContentStore already holds tasks in memory, updated via file events. Graph traversal takes ~1ms. Attached isReady in-memory via withReadiness in SearchService.applySnapshot so GET /api/search has zero disk I/O and instant response time.
2. Updated GET /api/search to support ?ready=true/false and return isReady on task records.
3. Added 'Ready only' toggle button to Kanban board header with BOARD_FILTER_BUTTON_CLASS styling, synced with ?ready=true in URL query params, and resetting on Clear filters.
4. Verified with unit and rendered tests in web-board-filters.test.tsx, server-search-endpoint.test.ts, and search-service.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Attached in-memory isReady to task records in SearchService and ContentStore for zero-IO search queries. Exposed isReady and ?ready=true filter on GET /api/search. Added 'Ready only' toggle button to Kanban Board filter bar with URL param sync and clear-filter integration. All verified with unit and rendered tests, TypeScript check, and Biome lint.
<!-- SECTION:FINAL_SUMMARY:END -->
