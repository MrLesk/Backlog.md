---
id: BACK-570
title: Make browser task loading asynchronous and idle-stable
status: Done
assignee:
  - '@Hubble'
created_date: '2026-08-03 18:03'
updated_date: '2026-08-03 18:22'
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
- [x] #1 The browser shell becomes usable before task-heavy corpus loading completes, and active Kanban tasks appear asynchronously afterward.
- [x] #2 Kanban excludes completed and archived tasks while reusing the single shared Core corpus; task detail, search, and other view semantics remain unchanged.
- [x] #3 The sidebar does not reload or rerender its full contents during task loading; only the task count shows a clear loading state and updates when active tasks arrive.
- [x] #4 A closed TaskDetailsModal performs no startup task fetch, and repeated browser reads plus duplicate preview do not cause duplicate full scans or idle tasks-updated publications.
- [x] #5 Task identity change detection ignores hydrated payload placement while genuine filesystem task changes still publish exactly as required.
- [x] #6 Focused regression tests cover the async browser boundary, Kanban filtering, sidebar count loading, one initial corpus load with no idle publication, and genuine task changes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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
Replaces the branch-local BACK-569 coordination task after a concurrently published active branch claimed the same ID. The prior task was archived through the CLI; this task is the authoritative implementation record.

Implemented a deferred, coalesced browser service boundary: the HTTP shell and lightweight metadata routes respond before the shared watcher-backed Core corpus is ready, while task/search/duplicate and WebSocket consumers reuse the same initialization. Repeated cross-branch reads now refresh only when the active-branch/config fingerprint changes. Task identity fingerprints use lifecycle identity fields instead of hydrated payload placement. The app applies lightweight shell data first, reuses loaded tasks in the modal, keeps sidebar navigation mounted with a count-only loading placeholder, and filters completed lifecycle entries only at the Kanban presentation boundary; archived identities remain excluded by the identity index.

Validation: focused browser/cache/publication suites passed (including 18/18 primary regressions and 13/13 server boundary/publication tests); bunx tsc --noEmit, bun run check ., and bun run build passed. Full bun test completed in 486.33s with 1883 pass, 5 skipped, and one deferred-initialization expectation failure; that test was updated to initialize through the task-list boundary and then passed in isolation. The affected server suites passed afterward.

PR review follow-up: added a bounded remote-ref refresh before cached cross-branch fingerprints so long-lived browser sessions discover upstream changes without resuming unconditional full corpus scans. Removed duplicate Definition of Done defaults and made the async browser regression fixtures platform-independent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made browser startup asynchronous around one shared Core corpus, eliminated idle cross-branch refresh/publication loops and the closed-modal fetch, stabilized sidebar loading, and kept completed/archived tasks off Kanban through a presentation filter. Verified with focused DOM/Core/server regressions, affected publication/fail-closed suites, TypeScript, Biome, and the production build.
<!-- SECTION:FINAL_SUMMARY:END -->
