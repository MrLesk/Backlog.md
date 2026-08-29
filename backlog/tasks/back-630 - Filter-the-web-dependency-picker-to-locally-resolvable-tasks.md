---
id: BACK-630
title: Filter the web dependency picker to locally-resolvable tasks
status: Done
assignee:
  - '@claude'
created_date: '2026-08-10 07:12'
updated_date: '2026-08-29 18:03'
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
1. Investigate: DependencyInput suggests from `availableTasks`, which TaskDetailsModal receives from App's search corpus. That corpus is cross-branch (branch-only tasks arrive with source 'local-branch' or 'remote'), while server-side validateDependencies() resolves against core.queryTasks({ includeCrossBranch: false }) plus drafts. So the picker offers tasks a save cannot accept.
2. AC1: give DependencyInput a `suggestableTasks` prop used only for autocomplete filtering, defaulting to `availableTasks`. Chip rendering keeps using the full corpus so dependencies saved before the local-only ruling still resolve and link.
3. AC1: in TaskDetailsModal derive the suggestion list from the live `availableTasks` prop - filter with isLocalEditableTask, then drop canonically ambiguous IDs by reusing buildTaskIdIndex/resolveTaskReference, which already drop collisions the same way route resolution does. Deriving beats a separate fetch: no stale snapshot while the modal stays open.
4. AC2: the CLI's LOCAL_TASK_LOOKUP_HINT ends by telling the reader to run 'backlog browser', which is nonsense once the rejected save happened in the browser. Rewrite that hint into web copy in the server's create-task and update-task error paths.
5. Verify: jsdom picker tests, a real-HTTP server test, and a live browser check against a two-branch fixture repo.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1 - picker filtered to locally-resolvable tasks. DependencyInput takes an optional `suggestableTasks` prop that feeds the autocomplete filter only; it defaults to `availableTasks`, so callers without a cross-branch corpus are unchanged. Chip display still resolves through the full `availableTasks` corpus, so a cross-branch dependency saved before the local-only ruling keeps rendering with its title and link instead of degrading to an unknown ID.

TaskDetailsModal derives `localAvailableTasks` from the live `availableTasks` prop rather than fetching its own list: the parent already refreshes that corpus, so the picker cannot suggest from a snapshot that went stale while the modal stayed open. The filter is isLocalEditableTask plus a canonical-ambiguity drop that reuses the existing buildTaskIdIndex/resolveTaskReference helpers (the index already drops canonical collisions the way route resolution does, so no second implementation of that rule was added). Ambiguous IDs are excluded because validateDependencies rejects them on save, so suggesting one would be a dead end.

AC2 - web-appropriate rejection copy. server/index.ts rewrites LOCAL_TASK_LOOKUP_HINT into WEB_TASK_LOOKUP_HINT in the create-task and update-task error paths. The rewrite targets the hint sentence itself rather than matching a specific error message prefix, so it is not coupled to the wording of the dependency error and also fixes the parent-task-not-found message, which carries the same hint.

Known gap (pre-existing, not a regression): drafts are valid dependency targets for validateDependencies, but the web corpus does not contain drafts (App loads them on the drafts page only), so the picker still cannot suggest a draft. It could not before this change either.

Verification:
- Live browser check against a purpose-built two-branch fixture repo (local TASK-1/TASK-3 on main, branch-only TASK-2 on a feature branch, checkActiveBranches on). The search corpus really does carry source=local-branch for the branch-only task, so the filter is not a no-op. Typing 'task' - which matches all three by title - suggested only TASK-3; TASK-2 was excluded and the current task was excluded as before. A pre-existing dependency on cross-branch TASK-2 still rendered as a resolved chip linking to /tasks/TASK-2 with its 'Blocked by TASK-2' readiness text.
- Same fixture over HTTP: PUT of a branch-only dependency returns 400 with 'Task lookups read only the local working copy; a task that exists only on another branch cannot be referenced yet.' and no 'backlog browser'.
- src/test/web-dependency-picker-local-only.test.tsx (jsdom): cross-branch task not suggested; canonically ambiguous local IDs (BACK-10 and BACK-010) not suggested. Both fail when the suggestableTasks wiring is removed, so they are not vacuous.
- src/test/server-dependency-error-copy.test.ts: real BacklogServer HTTP, create and update paths.
- bunx tsc --noEmit clean; bunx biome check clean on the touched .ts files (.tsx are outside this repo's biome includes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web dependency picker now suggests only tasks that local dependency validation will accept, and a rejected save explains itself in web terms.

DependencyInput gained an optional `suggestableTasks` prop that filters autocomplete only, so chips for dependencies saved before the local-only ruling still resolve through the full cross-branch corpus. TaskDetailsModal derives that suggestion list from the live task corpus - local-editable tasks, minus canonically ambiguous IDs - reusing the existing task-ID index helpers rather than restating the ambiguity rule. server/index.ts rewrites the CLI's 'use backlog browser' lookup hint into web copy on the create-task and update-task error paths, keyed on the hint itself so it also covers the parent-not-found message.

Verified in a live browser against a two-branch fixture repo (branch-only task excluded from suggestions, local task suggested, existing cross-branch chip still resolving), over real HTTP for the error copy, and by jsdom and server tests that were confirmed to fail without the change.
<!-- SECTION:FINAL_SUMMARY:END -->
