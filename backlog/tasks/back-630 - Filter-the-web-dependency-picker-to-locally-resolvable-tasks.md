---
id: BACK-630
title: Filter the web dependency picker to locally-resolvable tasks
status: Done
assignee:
  - '@claude'
created_date: '2026-08-10 07:12'
updated_date: '2026-08-20 22:23'
labels: []
dependencies: []
priority: medium
ordinal: 266000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the PR #898 (BACK-623) verification round. Since dependency validation moved to local working-copy resolution (owner ruling: CLI/core local-only), the browser dependency picker still suggests the cross-branch corpus (src/web/components/DependencyInput.tsx availableTasks from App's search corpus, TaskDetailsModal.tsx), so picking a branch-only task now fails on save with a missing-dependency error whose hint says to use 'backlog browser' - confusing when the user is already in the browser. On v1.50.0 this save succeeded, so it is a known, accepted web-surface regression of the local-only ruling, deferred from the v1.50.1 hotfix. Filter the picker to tasks that local validation will accept, and adjust the web-surface error copy so it does not tell browser users to open the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The dependency picker only suggests tasks local validation accepts
- [x] #2 A rejected dependency save in the web UI shows copy appropriate for the web surface
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Investigate: DependencyInput.tsx suggests from `availableTasks`, which TaskDetailsModal fills from App's search corpus (cross-branch). Server-side validateDependencies() (task-builders.ts) only accepts core.queryTasks({ includeCrossBranch: false }) plus drafts. Web picker never suggested drafts anyway (search results only carry type=task), so scope is: stop suggesting branch-only tasks.
2. Frontend fix (AC1): add a `suggestableTasks` prop to DependencyInput, used only for the autocomplete filter (chip display keeps using the full `availableTasks` corpus so already-saved cross-branch dependency chips still resolve/link). TaskDetailsModal fetches a local-only task list via apiClient.fetchTasks({ crossBranch: false }) when the modal opens (mirrors the existing offBoardDependencies fetch pattern) and passes it as suggestableTasks.
3. Backend fix (AC2): server/index.ts surfaces Core-thrown error messages verbatim, including the CLI-oriented LOCAL_TASK_LOOKUP_HINT ("...use 'backlog browser'..."), which is nonsensical once you're already in the browser. Add formatDependencyErrorForWeb() that rewrites only messages starting with "The following dependencies do not exist" (the missing-dependency error), swapping the hint for browser-appropriate copy. Apply in handleCreateTask and handleUpdateTask catch blocks (covers both the create-task save path and the inline dependency edit path).
4. Add regression tests: a DependencyInput/TaskDetailsModal interactive test (mounted with react-dom/client + act, apiClient.fetchTasks mocked) proving a cross-branch-only task is not suggested while a local task is; a server test proving the missing-dependency error response no longer contains the CLI hint.
5. Verify: bunx tsc --noEmit, bunx biome check on touched files, scoped test run, then full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1: DependencyInput now takes a `suggestableTasks` prop (defaults to `availableTasks`, used only for autocomplete filtering; chip display still uses `availableTasks` so already-saved cross-branch dependency chips keep resolving/linking). TaskDetailsModal fetches a local-only task list via apiClient.fetchTasks({ crossBranch: false }) when the modal opens (mirrors the existing offBoardDependencies fetch pattern) and passes it as suggestableTasks - matching exactly what validateDependencies() in task-builders.ts checks (core.queryTasks({ includeCrossBranch: false })). Drafts stay out of scope: the web picker never suggested them before this fix either (search results only carry type=task).

AC2: server/index.ts now has formatDependencyErrorForWeb(), which rewrites only messages starting with "The following dependencies do not exist" - swapping the CLI's LOCAL_TASK_LOOKUP_HINT ("...use 'backlog browser'...") for browser-appropriate copy. Applied in handleCreateTask and handleUpdateTask catch blocks (covers both the create-task save path and the inline dependency edit path used by handleInlineMetaUpdate). Left the parent-task-not-found error (same hint constant, different message shape) untouched since it's out of this task's scope.

Verification:
- New interactive test src/test/web-dependency-picker-local-only.test.tsx: mounts TaskDetailsModal with a cross-branch task and a local task, mocks apiClient.fetchTasks to assert it's called with crossBranch:false and to return only the local task, types a query matching both by title, and asserts the suggestion dropdown shows only the local task. Verified fail-before/pass-after via git stash on the DependencyInput/TaskDetailsModal changes.
- New server test src/test/server-dependency-error-copy.test.ts: PUTs/POSTs a missing dependency through the real BacklogServer HTTP API and asserts the error response contains the task ID but not "backlog browser". Verified fail-before/pass-after via git stash on server/index.ts.
- Fixed a real regression the fix surfaced in the existing src/test/web-task-details-modal-unsaved-navigation.test.tsx: it typed a known dependency ID and pressed Enter expecting a suggestion, but didn't mock apiClient.fetchTasks, so the new local-only fetch (real network call in jsdom, swallowed by the effect's .catch) returned nothing to suggest. Added the same fetchTasks mock pattern used elsewhere in the test file, restored in afterEach, plus an extra microtask flush for the two-hop async fetch->then->setState chain.
- bunx tsc --noEmit: clean.
- bunx biome check on touched .ts files: clean (DependencyInput.tsx/TaskDetailsModal.tsx are .tsx, outside this repo's biome includes, consistent with all other .tsx files).
- Full suite (bun test --timeout=10000): 2341 pass / 6 skip / 1 fail across 245 files. The 1 fail (config-commands.test.ts, a YAML tab-indentation parsing edge case) is unrelated - reproduces identically on unmodified main, confirmed via git stash.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Filtered the web dependency picker to locally-resolvable tasks and fixed the rejected-save error copy for the web surface.

DependencyInput gained a `suggestableTasks` prop (autocomplete only; chip display keeps the full corpus), fed by a new local-only task fetch (apiClient.fetchTasks({ crossBranch: false })) in TaskDetailsModal, so the picker now only suggests what local dependency validation (task-builders.ts validateDependencies) will actually accept.

server/index.ts's handleCreateTask/handleUpdateTask now rewrite the missing-dependency error's CLI-oriented "use 'backlog browser'" hint into web-appropriate copy before returning it to the client.

Verified with two new tests (interactive DependencyInput/TaskDetailsModal suggestion test, and a real-HTTP server error-copy test), both confirmed fail-before/pass-after via git stash. Fixed a regression surfaced in an existing unsaved-navigation test that needed the new fetch mocked. Full suite: 2341 pass / 6 skip / 1 unrelated pre-existing fail (config-commands.test.ts, reproduces on unmodified main).
<!-- SECTION:FINAL_SUMMARY:END -->
