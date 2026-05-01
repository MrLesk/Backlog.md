---
id: BACK-457
title: Avoid stale task reads after milestone mutations
status: To Do
assignee:
  - '@codex'
created_date: '2026-05-01 21:49'
labels:
  - bug
  - web
  - ci
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/actions/runs/25233629990'
  - 'https://github.com/MrLesk/Backlog.md/pull/620'
modified_files:
  - src/server/index.ts
  - src/test/server-search-endpoint.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The post-merge CI run for BACK-456 failed because an immediate `GET /api/task/:id` after Web API milestone removal sometimes read stale milestone data from the server ContentStore. Direct task reads should prefer the local task file so read-after-write behavior is deterministic, while still falling back to the store for non-local/cross-branch tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `GET /api/task/:id` returns the freshly persisted local task when the file exists, even if ContentStore has stale data.
- [ ] #2 Cross-branch/store-backed task lookup still works when no local task file exists.
- [ ] #3 The failing milestone removal Web API test passes reliably.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
