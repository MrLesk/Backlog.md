---
id: BACK-569
title: Make browser task loading asynchronous and idle-stable
status: In Progress
assignee:
  - '@Hubble'
created_date: '2026-08-03 17:40'
updated_date: '2026-08-03 17:41'
labels: []
dependencies: []
type: bug
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render the browser shell immediately while the shared watcher-backed Core corpus initializes once in the background. Reuse that corpus across browser views, filter completed and archived tasks from Kanban without introducing a second active-only corpus, keep the sidebar stable with a count-only loading state, and eliminate idle publications and duplicate full scans while preserving genuine filesystem updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The browser shell becomes usable before task-heavy corpus loading completes, and active Kanban tasks appear asynchronously afterward.
- [ ] #2 Kanban excludes completed and archived tasks while reusing the single shared Core corpus; task detail, search, and other view semantics remain unchanged.
- [ ] #3 The sidebar does not reload or rerender its full contents during task loading; only the task count shows a clear loading state and updates when active tasks arrive.
- [ ] #4 A closed TaskDetailsModal performs no startup task fetch, and repeated browser reads plus duplicate preview do not cause duplicate full scans or idle tasks-updated publications.
- [ ] #5 Task identity change detection ignores hydrated payload placement while genuine filesystem task changes still publish exactly as required.
- [ ] #6 Focused regression tests cover the async browser boundary, Kanban filtering, sidebar count loading, one initial corpus load with no idle publication, and genuine task changes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused failing tests for the async shell/data boundary, Kanban active-task filtering, stable sidebar count loading, cached repeated reads, identity-only fingerprints, and genuine watcher publications.
2. Split lightweight browser shell/config bootstrap from deferred task/search loading while retaining one shared watcher-backed Core corpus.
3. Remove the closed modal startup fetch, reuse already-loaded tasks, and keep task-count loading isolated from the sidebar shell.
4. Replace unconditional read refreshes with cache/fingerprint-aware behavior and restrict identity fingerprints to identity fields while preserving real change publication.
5. Run targeted tests, typecheck, lint, build, simplify the implementation, finalize the task, and publish a ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation reproduced the loop on current main: modal startup /api/tasks triggered unconditional cross-branch refreshes; hydrated titles moved between same-path branch records, changing the identity fingerprint and publishing tasks-updated; App then reloaded all data. API timeouts retried without cancelling queued server scans. The implementation must keep one complete shared corpus and filter Kanban from that cache rather than add an active-only loader.
<!-- SECTION:NOTES:END -->
