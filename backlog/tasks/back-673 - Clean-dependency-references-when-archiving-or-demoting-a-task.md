---
id: BACK-673
title: Clean dependency references when archiving or demoting a task
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-01 17:11'
updated_date: '2026-09-01 18:19'
labels: []
dependencies: []
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A user reported a task that mysteriously depended on another task they never linked. This is how it happens, reproduced on current main.

Archiving a task removes its ID from the dependencies of active tasks that reference it, but not from tasks in backlog/completed. Demoting a task to a draft cleans nothing at all: the record is renamed from TASK-N to DRAFT-N and every dependent keeps a reference to TASK-N, which renders as 'unknown task ID'. Both operations also free the numeric slot, so the next created task can be allocated that same ID. At that point the stale reference silently resolves to a different, unrelated task and the graph reports it as resolved rather than failing closed. Reproduced end to end: a completed task depending on TASK-5, archive TASK-5, create an unrelated task that is allocated TASK-5, and the completed task now shows 'TASK-5 - Totally unrelated new task'.

Fix: archiving and demoting must find every task that depends on the affected ID and remove that reference, across both the working copy and the completed corpus, and report which tasks were changed rather than doing it silently. Implement it once in core so every surface that archives or demotes (CLI, TUI, web, MCP) inherits it; do not add per-surface cleanup.

Completing a task must NOT remove references: a completed dependency is exactly what readiness needs to see, and the record stays resolvable in the completed corpus.

Decision recorded for the implementer: on demote, references are removed rather than rewritten to the new DRAFT-N identity. Rewriting would preserve the relationship, and drafts are accepted as dependency targets today, but removal is the behavior the maintainer chose for its simplicity. Do not rewrite.

Not in scope: whether archived or demoted IDs should stop being recycled by the allocator. That touches ID allocation and stays as it is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archiving a task removes its ID from the dependencies of every referencing task in both the working copy and the completed corpus
- [x] #2 Demoting a task to a draft performs the same reference cleanup, so no dependent is left pointing at the vacated ID
- [x] #3 Both operations report which tasks had a reference removed instead of changing them silently
- [x] #4 Completing a task never removes references to it from other tasks
- [x] #5 The cleanup lives in core and applies to every surface that archives or demotes, with no per-surface duplication
- [x] #6 A regression test reproduces the misbinding end to end: reference the task, archive or demote it, allocate the freed ID to a new task, and assert no dependent silently resolves to the new task
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Generalize the existing archive sanitizer in core (sanitizeArchivedTaskLinks) into one vacated-id cleanup that scans the active working copy AND the completed corpus for dependencies/references naming the id, and returns the sanitized records plus the ids that changed.
2. Write active dependents through the existing writeTasksBulk path (content-store batching preserved) and completed dependents through fs.saveTask (filePath is preserved, so it rewrites in place) - completed records must not go through updateTask, which would treat them as new and fire the onStatusChange callback.
3. archiveTask: compute the cleanup before locking, then hold withTaskLocks over the archived task plus every dependent (active and completed) across the move and the writes, exactly as archive does today. Return { success, cleanedTaskIds } instead of a bare boolean.
4. demoteTask: same shape - compute cleanup, hold withTaskLocks over the task plus dependents around fs.demoteTask (which takes the create lock inside; task-lock-then-create-lock order matches the existing demote paths). Return { success, cleanedTaskIds }.
5. demoteTaskWithUpdates (the 'task edit -s Draft' demotion) runs the same shared cleanup inside its lock span so no surface can demote without it.
6. completeTask stays untouched: a completed dependency is meaningful for readiness.
7. Surfaces report the result from core, no per-surface cleanup: CLI archive/demote print one terse line, TUI appends to its existing transient footer, MCP adds one result line, the web DELETE/demote endpoints return the cleaned ids and App.tsx reuses the existing SuccessToast flow.
8. Tests: end-to-end misbinding regression (reference, archive/demote, allocate the freed id to a new task, assert the dependent does not resolve to it), completed-corpus cleanup, demote cleanup, report output, and complete NOT cleaning. Update the existing dependency test that asserts the completed corpus is left alone.
9. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core: replaced the archive-only sanitizer with one shared cleanup for any operation that vacates a task ID.

- collectVacatedIdCleanup(id) scans the active working copy AND the completed corpus for dependencies/references naming the ID and returns the sanitized records per corpus; writeVacatedIdCleanup writes them and returns the changed IDs plus file paths. sanitizeArchivedTaskLinks was renamed sanitizeVacatedTaskLinks and is now reached only through these two.
- Active dependents keep going through writeTasksBulk (content-store batching, updatedDate handling unchanged). Completed dependents are rewritten in place with fs.saveTask (filePath is preserved) instead of updateTask: updateTask looks the record up in the active corpus, would not find it, and would treat the write as a brand-new task whose status changed, firing the onStatusChange callback. The in-process ContentStore is refreshed with transitionTask(id, updated), the same call completion uses.
- archiveTask and demoteTask now return { success, cleanedTaskIds } instead of a bare boolean. demoteTaskWithUpdates (the 'task edit -s Draft' demotion) runs the same cleanup, so no surface can demote without it.
- completeTask is untouched: a completed dependency stays resolvable and readiness needs it.

Locking: the cleanup set is computed before the lock, then archiveTask, demoteTask and demoteTaskWithUpdates all hold fs.withTaskLocks over the vacated task plus every dependent (active and completed) for the whole move+write span. withTaskLocks sorts by ID, and the create lock is always taken inside the task locks, so ordering matches every other multi-file mutation and cannot deadlock. commitWrittenFile gained an optional trailing list of also-written paths so the demote commit covers the cleaned files, exactly as the archive commit already did.

Surfaces only display: formatDependencyCleanupMessage in utils/dependency-graph.ts is the single wording ('Removed references to TASK-5 from TASK-2, TASK-3'). CLI archive/demote print it as a second line; the TUI board and task viewer show it in the existing transient footer via formatTaskArchivedMessage; MCP adds it as a summary line above the task body; the web DELETE/demote endpoints return cleanedTaskIds and App.tsx shows it through the existing SuccessToast flow (archive directly, demote via a new onDependencyCleanup prop on TaskDetailsModal).

Deliberate boundaries: drafts are not scanned (they are neither corpus, and an existing test pins that archive leaves them alone); parentTaskId is not rewritten (existing behavior); demote removes references instead of rewriting them to DRAFT-N, per the task decision; ID recycling is unchanged. 'backlog task edit <id> -s Draft' performs the cleanup but prints only 'Updated task DRAFT-N' - the cleanup report rides on the dedicated archive/demote commands, because threading it through the generic edit command would change editTaskOrDraft/updateTaskFromInput return shapes across CLI, server and MCP.

Review round (PR 987, four findings):

1. Cleanup snapshot taken outside the locks (P1). collectVacatedIdCleanup ran before withTaskLocks, so a dependent edited in that window was rewritten from the pre-edit snapshot (lost update) and a task that started referencing the ID in that window was never locked and kept the reference. New Core.withVacatedIdCleanup(target, vacatedId, run) takes the locks, re-scans the corpus inside them, and if the fresh scan names a task the held locks do not cover it releases, widens the set and runs again (bounded at 5 attempts); run only ever sees a set that was read and locked as one state. archiveTask, demoteTask and demoteTaskWithUpdates all go through it.
2. Move outcome recorded after cleanup could fail (P2). demoteTask now assigns demotion.success/moved immediately after fs.demoteTask returns, before the content-store transition and the cleanup writes, so a cleanup write that throws still surfaces demotionState 'moved' and the web handler refreshes instead of inviting a retry of a demotion that already happened.
3. Cleaned active dependents not published (P2). writeTasksBulk now upserts each written task into an initialized ContentStore. Note for the record: the store also patches filesystem.saveTask and publishes writes itself, so the plain path was already correct and no non-contrived test fails without this line; the explicit publish removes the dependency on that patch being installed and on updateTaskFromDisk's reconcile not bailing out on a stale watcher epoch.
4. Demoted record kept its own vacated ID (P2). A record whose links named its own ID was excluded from cleanup as 'self', so demotion copied that link into the new draft. isExactTaskReference and the sanitizer moved to src/utils/task-links.ts (withoutVacatedTaskLinks), now shared by the corpus cleanup in core and by both demote paths, which sanitize the record while building the draft.

Six new tests in src/test/vacated-task-references.test.ts. Five fail on the pre-fix commit (verified by stashing the source fixes and running the new file against 6a4fb75c): stale-snapshot overwrite, missed late dependent, missing demotionState, and the self-reference on both demote paths. The concurrency tests are deterministic - no sleeps and no racing threads: interleaveAtLockAcquisition patches filesystem.withTaskLocks to run one edit through a second Core instance at the exact moment the operation asks for its locks, which is the window the scan used to be taken in.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Archiving or demoting a task now removes every stored reference to the ID it vacates, across the active working copy and the completed corpus, through one cleanup in core that both operations and every surface inherit. Both report the records they changed instead of doing it silently; completing a task still changes nothing, because a completed dependency stays resolvable.

Verified with src/test/vacated-task-references.test.ts: the end-to-end misbinding regression references a task, archives (and separately demotes) it, lets the allocator hand the freed ID to a new task, and asserts the dependent resolves to nothing rather than to the unrelated task - checked through the dependency graph, not just the stored list. It also covers completed-corpus references, the edit-to-Draft demotion path, the CLI report lines for archive and demote (including staying quiet when nothing referenced the task), and complete leaving references intact. Existing tests in dependency.test.ts and references.test.ts that pinned the completed corpus as untouched were updated to the corrected behavior. bunx tsc --noEmit, bun run check ., and the full bun run test suite (2812 pass, 8 skip, 0 fail) are green.
<!-- SECTION:FINAL_SUMMARY:END -->
