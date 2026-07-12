---
id: BACK-457
title: Avoid stale task reads after milestone mutations
status: Done
assignee:
  - '@codex'
created_date: '2026-05-01 21:49'
updated_date: '2026-05-01 21:55'
labels:
  - bug
  - web
  - ci
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/25233629990'
  - 'https://github.com/MrLesk/Backlog.md/pull/620'
modified_files:
  - src/mcp/tools/milestones/handlers.ts
  - src/server/index.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The post-merge CI run for BACK-456 failed because Web API milestone removal could read or return stale milestone data from the server ContentStore immediately after task writes. Milestone mutations should load editable local tasks directly from disk, and direct task reads should prefer the local task file while still falling back to the store for non-local/cross-branch tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `GET /api/task/:id` returns the freshly persisted local task when the file exists, even if ContentStore has stale data.
- [x] #2 Cross-branch/store-backed task lookup still works when no local task file exists.
- [x] #3 Milestone removal uses fresh local task files when clearing or reassigning tasks.
- [x] #4 The failing milestone removal Web API test passes reliably.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the stale milestone mutation CI failure by loading editable local tasks directly from disk during milestone rename/remove operations and by making direct task GETs prefer a fresh local file before falling back to the ContentStore. Verified with the failing two-file test combination, full bun test with CI concurrency, typecheck, and Biome check.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
