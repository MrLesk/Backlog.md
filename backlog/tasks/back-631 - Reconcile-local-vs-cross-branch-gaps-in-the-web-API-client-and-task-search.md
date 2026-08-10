---
id: BACK-631
title: Reconcile local-vs-cross-branch gaps in the web API client and task search
status: To Do
assignee: []
created_date: '2026-08-10 07:14'
labels: []
dependencies: []
priority: low
ordinal: 267000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two consistency gaps flagged by Codex on PR #898 (BACK-623), both verified real but not user-facing, deferred from the v1.50.1 hotfix. (1) ApiClient.fetchTasks (src/web/lib/api.ts:194) only appends crossBranch=true and omits the param for {crossBranch:false}; since the server default for an omitted param is now cross-branch, an explicit local-only request returns cross-branch tasks. fetchTasks currently has zero production callers, so this is latent - send crossBranch=false explicitly. (2) The local task search index (createTaskSearchIndex, shared via src/utils/task-search.ts) includes labels and assignees in bodyText and per-segment ID variants, while the cross-branch SearchService (src/core/search-service.ts buildTaskBodyText) omits them, so toggling includeCrossBranch changes which tasks match identical queries. Align the indexed field sets with one shared searchable-task builder.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fetchTasks with crossBranch false requests and receives the local view
- [ ] #2 Local and cross-branch task search index the same field set via a shared builder
- [ ] #3 A test pins search parity for a query matching only a label or assignee
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
