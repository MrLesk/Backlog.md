---
id: BACK-273.05
title: '273.05: Server endpoints on shared store/search'
status: Done
assignee:
  - '@codex'
created_date: '2025-09-19 18:34'
updated_date: '2025-09-21 20:46'
labels:
  - server
  - search
  - infra
dependencies: []
parent_task_id: task-273
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor the Bun server and API client to source data through the content store and expose a unified /api/search endpoint. Ensure websocket notifications trigger reindexing and consumers no longer rebuild Fuse in the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server bootstraps the content store/search service once and hands snapshots to existing task/doc/decision handlers.
- [x] #2 New /api/search endpoint accepts query + filters and returns SearchResult; existing list endpoints remain compatible.
- [x] #3 Websocket broadcasts trigger search index refreshes without leaking stale caches.
- [x] #4 bun run check ., bunx tsc --noEmit, and bun test cover server + API client changes.
<!-- AC:END -->

## Implementation Notes

- Centralized server data access via ContentStore/SearchService with loose ID matching helper.
- Added Fuse id/dependency variants plus padded-ID integration tests covering /api/search & /api/task queries.
- Updated TUI list styles to eliminate any-casts; bun run check ., bunx tsc --noEmit, bun test all pass.
