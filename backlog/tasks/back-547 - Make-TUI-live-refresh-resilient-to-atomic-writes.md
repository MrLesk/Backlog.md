---
id: BACK-547
title: Make TUI live refresh resilient to atomic writes
status: In Progress
assignee:
  - '@back547-agent'
created_date: '2026-07-14 19:59'
updated_date: '2026-07-14 22:00'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/786'
modified_files:
  - src/utils/task-watcher.ts
  - src/ui/unified-view.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/task-watcher.test.ts
  - src/test/unified-view-loading.test.ts
  - src/test/tui-interactive-editor-handoff.test.ts
priority: high
type: bug
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v1.48.0 packaged TUI can miss the single filesystem event emitted during CLI create, edit, or archive operations because the watcher reads before the task file is stable, receives no later event, and remains stale until restart. Current source remains timing-dependent. This repairs existing live refresh behavior, not a new feature. Scope is the current checkout only. Cross-branch and separate-worktree refresh are explicitly excluded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI and atomic external create, edit, status, archive, and delete operations refresh the open board and list reliably without restart.
- [ ] #2 The watcher retries, debounces, or reconciles create and change events until the file parses stably or absence is confirmed, without infinite retries or duplicate updates.
- [ ] #3 Selection remains valid when the selected task changes, moves status, archives, or deletes, and active filters reflect reconciled state.
- [ ] #4 Configuration and status updates continue refreshing correctly.
- [ ] #5 Cross-branch and separate-worktree changes are explicitly out of scope.
- [ ] #6 Real filesystem tests cover single-event partial create, edit, archive or delete, and recovery and error bounds. Integration tests cover unified-view callback behavior.
- [ ] #7 A compiled-binary PTY smoke test verifies that a packaged CLI mutation becomes visible in the open TUI within a bounded time on supported CI platforms.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add bounded per-task reconciliation to the task watcher so one create, change, rename, archive, or delete event is debounced, retried until usable stable content or confirmed absence, deduplicated, and cancelled cleanly on stop.
2. Route watcher changes through one unified-view task-state updater, keep selected task identity current, and add a live-update subscription to the active task list so its filters and selection recompute from reconciled tasks while preserving existing board and config refresh behavior.
3. Add deterministic watcher tests with real filesystem reads and controlled single events for partial create, edit, archive/delete, retry recovery, callback deduplication, and bounded failure, plus unified-view callback integration coverage.
4. Extend the supported compiled-binary PTY suite with a bounded CLI-mutation live-refresh smoke scenario, then run focused tests, typecheck, Biome, the compiled binary PTY smoke, and self-review against BACK-547.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented bounded task watcher reconciliation for the current checkout. Task events now debounce by normalized ID, require two stable usable reads, retry transient partial or missing content within a finite budget, suppress duplicate publications, cancel stale generations, and reconcile the directory when atomic writes expose only a temporary-file event. Branch-only tasks are excluded from current-checkout reconciliation.

Unified view now applies add, change, archive, and delete callbacks through one state transition, keeps selected task objects valid, and publishes refreshed task and configuration snapshots to both the board and active task list. The task list rebuilds its search index and filters from the reconciled state.

Coverage added for controlled single-event partial create and edit, temporary-file atomic create, archive and delete absence, duplicate suppression, bounded incomplete content, branch-only scope, real fs.watch plus child CLI atomic edit, unified callback selection behavior, and a bounded source or compiled-binary PTY live-refresh smoke.

Validation:
- bunx tsc --noEmit
- bun run check .
- final focused watcher, unified, filter, and board tests: 34 passed
- source PTY suite: 3 passed
- compiled build smoke: passed
- compiled-binary PTY suite: 3 passed
- full suite: 1701 passed, 3 interactive skips, 0 failed

Review fixes: task-list live updates now carry the unified selected task, preserving the next neighbor after the selected task is removed. Task watcher removals now require an independent active-task filename snapshot, so malformed or persistently unreadable files are retained during direct and directory reconciliation while true absence is still published. Validation: 10 watcher tests passed; source PTY suite passed 4 of 4, including selected B removal choosing C in 549 ms; bunx tsc --noEmit passed; Biome checked 332 files; full bun test passed 1705 tests with 4 opt-in PTY skips and 0 failures.
<!-- SECTION:NOTES:END -->
