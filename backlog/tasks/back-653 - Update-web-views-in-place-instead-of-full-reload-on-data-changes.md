---
id: BACK-653
title: Update web views in place instead of full reload on data changes
status: To Do
assignee: []
created_date: '2026-08-29 22:03'
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
- [ ] #1 A task mutation from the UI or an external edit updates the board and list views in place without showing the global loading shell
- [ ] #2 A single-card drag causes no full refetch burst
- [ ] #3 Full refetch remains as a fallback for changes that cannot be applied incrementally, and initial page load is unchanged
- [ ] #4 Automated web tests cover the in-place update path for edit, move, and external change
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
