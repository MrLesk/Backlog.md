---
id: BACK-653
title: Update web views in place instead of full reload on data changes
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-29 22:03'
updated_date: '2026-08-30 23:57'
labels:
  - web
  - bug
dependencies: []
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every server file-watcher broadcast ("tasks-updated") makes the web app call refreshData() -> loadAllData(), which sets a global loading state and refetches statuses, config, milestones, archived milestones, search, and duplicates — blanking the board to the loading shell on every mutation, visually indistinguishable from a page reload. The maintainer finds this very annoying; a plain single-card drag triggers the full refetch burst twice. The single-card reorder path already demonstrates the right pattern: onTasksUpdated applies a surgical in-place store update. Route watcher-driven updates through incremental state updates so views re-render in place, falling back to a full refetch only when the change cannot be resolved incrementally.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A task mutation from the UI or an external edit updates the board and list views in place without showing the global loading shell
- [x] #2 A single-card drag causes no full refetch burst
- [x] #3 Full refetch remains as a fallback for changes that cannot be applied incrementally, and initial page load is unchanged
- [x] #4 Automated web tests cover the in-place update path for edit, move, and external change
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server: generalize the debounced broadcastTasksUpdated into broadcastDataUpdated(scope) — store/task events keep the 'tasks-updated' wire message; milestone endpoints (create/update/remove/archive) send 'milestones-updated'; the debounce merges a pending tasks scope up into milestones.
2. Client (App.tsx): generalize the single-card reorder mechanism (onTasksUpdated -> applyReorderedTasks surgical store update) into the refresh path. Add refs mirroring tasks/docs/decisions/milestoneEntities/archivedMilestones so refreshes can reconcile without resubscribing the WebSocket.
3. New incremental refreshTasksData(includeMilestones): fetch /api/search only (plus milestones + archived milestones when milestone-scoped), normalize milestones as today, then reconcile into state with an identity-preserving deep-equal reconcileById (unchanged records keep object identity, unchanged lists keep array identity — the no-op guard: a broadcast echoing a change already applied surgically produces zero state churn). Never touches isLoading; clears loadError on success. Refetch the duplicate repair plan in the background only when the reconciled task list actually changed.
4. Wire-up: refreshData (post-mutation callbacks + WS 'tasks-updated') = incremental tasks scope + drafts-updated event; WS 'milestones-updated' and MilestonesPage onRefreshData = incremental milestone scope; full loadAllData stays for initial load, config-updated, connection-restore, cross-branch indexing loaded/onclose paths, and as the fallback when an incremental refresh throws.
5. Shared helper src/web/utils/reconcile.ts (deepEqual + reconcileById) reused for tasks/docs/decisions.
6. Tests: jsdom App-level tests for in-place edit, move, external change (assert no statuses/config/milestone refetch, no loading shell), no-op echo after a surgical drag (identity preserved, no duplicates refetch), and the fallback path (search failure -> full loadAllData). Server test for milestone-scoped broadcast message.
7. Verify: bunx tsc --noEmit, bun run check ., bun test; measure request counts for a single drag before/after with the real server.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: server broadcastDataUpdated(scope) keeps 'tasks-updated' for store/task events and sends 'milestones-updated' from milestone endpoints (create now broadcasts too). Client refreshTasksData refetches only /api/search (plus milestone entities on milestone scope) and reconciles tasks/docs/decisions in place via reconcileById (identity-preserving deep-equal); duplicates plan refetch is gated on the task ID multiset changing; full loadAllData remains for initial load, config-updated, indexing loaded/reconnect, and incremental failure fallback. Measured on a live server (6-task board, drop TASK-1 into In Progress): before = reorder POST + 6-request burst (statuses, config, milestones, archived, search, duplicates); after = reorder POST + 1 background search reconcile. External file edit/status change: 1 search request, view updates in place. Milestone create: 3 requests (milestones, archived, search).

Deeplink suite (web-task-detail-deeplink) updated: 4 scenarios pinned the old full-burst expectations (config on tasks-updated, duplicates plan on same-ID reconciliations); now pin the incremental behavior, 31/31 pass. Full suite: 2748 pass / 2 fail (mcp-tasks task_search + server-statistics reconcile, both known full-suite-concurrency flakes, both pass isolated 43/43). tsc and biome clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Watcher broadcasts and post-mutation refreshes now update web views in place: the server publishes scoped data broadcasts (tasks-updated / milestones-updated, milestone create now broadcasts too) and the client generalizes the single-card reorder onTasksUpdated pattern into refreshTasksData, which refetches only the search corpus (plus milestone entities on milestone scope) and reconciles tasks/docs/decisions into the store with identity-preserving deep-equal (src/web/utils/reconcile.ts); the duplicate repair plan refetch is gated on the task ID multiset changing, and full loadAllData remains for initial load, config-updated, cross-branch indexing completion/reconnect, and as the incremental-failure fallback. Verified with 6 new jsdom App-level tests (edit, move, external create, echo no-op, milestone scope, fallback), reconcile unit tests, a server milestone-broadcast test, the updated 31-test deeplink suite, and live browser measurement: a single-card drag dropped from reorder POST + 6-request refetch burst to reorder POST + 1 background search reconcile, with external edits costing exactly 1 request and no loading shell.
<!-- SECTION:FINAL_SUMMARY:END -->
