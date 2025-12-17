---
id: task-331
title: Fix content store refresh dropping cross-branch tasks
status: Done
assignee:
  - '@codex'
created_date: '2025-12-03 18:10'
updated_date: '2025-12-03 18:17'
labels:
  - bug
  - content-store
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refreshing tasks from the filesystem currently reloads only the local branch tasks and drops cross-branch read-only entries after any watcher event. Update refresh logic to load tasks the same way as initial load (including cross-branch) so watcher updates do not remove remote tasks. Add coverage to prevent regressions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Refreshing tasks via watcher/refresh preserves cross-branch (read-only) tasks; they remain visible alongside local tasks after filesystem updates.
- [x] #2 Task refresh path uses the same loader as initial load or merges results to include cross-branch tasks.
- [x] #3 Automated tests cover the refresh behavior to prevent regression.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated content store task refresh to reuse the taskLoader so cross-branch tasks persist after watcher-triggered reloads; added regression test covering loader-based refresh; reran bun test src/test/content-store.test.ts.
<!-- SECTION:NOTES:END -->
