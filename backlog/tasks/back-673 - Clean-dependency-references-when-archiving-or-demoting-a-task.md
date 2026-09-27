---
id: BACK-673
title: Clean dependency references when archiving or demoting a task
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 17:11'
updated_date: '2026-09-01 22:03'
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

10. Canonicalize task lock keys, multi-lock deduplication, and ordering while leaving draft locking unchanged; compare cleanup lock coverage with taskIdsEqual.

11. Return task-edit cleanup metadata from the shared edit path and include the cleanup report in MCP task_edit output.

12. Mark post-demotion cleanup and commit failures with distinct causes and show accurate recovery guidance in the task modal.

13. Notify users of an already-moved archive before attempting the refresh.

14. Add one pre-fix regression test per finding, then run targeted tests, type-check, Biome, and the full suite.
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

Closing review round (PR 987, three findings):

1. Ordering as a narrowing for the locked-rescan race - evaluated and NOT adopted. The premise holds for demote but not for archive, and archive is the path the bug report came from. Checked on the shipped CLI in a scratch project: after 'task archive TASK-1', 'task edit TASK-2 --dep TASK-1' still succeeds, because validateDependencies resolves against tasks + drafts + completed + archived (src/utils/task-builders.ts) and an archived ID is deliberately a valid dependency target - src/test/dependency.test.ts pins that with 'accepts an archived task as a dependency at create and edit time'. So vacating before the scan narrows nothing for archive. After 'task demote TASK-1' the same edit does fail ('The following dependencies do not exist: TASK-1'), so ordering would narrow the window for the two demote paths only. Adopting it there alone would: give up the all-or-nothing shape (today a contended dependent aborts the operation before anything moves; with the reorder the record would already be demoted when the lock error surfaces), split one shared cleanup into two orderings for three callers, and require locking a dependent discovered only after the irreversible step - re-opening the lost-update hole fixed in the previous round unless more machinery is added after the point of no return. Not worth it for a narrowing that covers one of three paths, so the current order stands and the residual is documented on Core.withVacatedIdCleanup.

Residual window, plainly: a task that starts referencing the ID after the final in-lock scan is not locked and keeps its reference. It cannot be locked, because it was not a dependent when the set was fixed, and closing it would need a corpus-wide write lock, which is disproportionate here and would contend with the create/allocation lock. The stale reference is not silent - the graph renders it as an unknown task ID - until the allocator hands the number out again, at which point it rebinds. Not recycling vacated IDs is the only complete fix and is explicitly out of scope for this task.

2. Cleanup notice timer (src/web/App.tsx). reportDependencyCleanup now keeps its timeout in a ref and cancels the pending one before showing a new notice, so a second cleanup within the four-second window is no longer cut short by the first notice's expiry.

3. Archive notice ordering (src/web/App.tsx). handleArchiveTask records the notice immediately after the archive response, before handleCloseModal and refreshData, matching what the demote flow already does. The report no longer depends on the refresh completing.

New src/test/web-dependency-cleanup-notice.test.tsx drives the real App through the task list and the details modal in JSDOM. Both tests fail on the pre-fix App.tsx (verified by stashing it): the first times out waiting for the notice while the refresh is held open, the second shows no notice at all once the first timer fires. The second test takes control of the 4000 ms timeout only, so it fires the first notice's expiry deterministically instead of waiting on wall-clock time.

Follow-up found while fixing finding 3: reporting the notice before closing the modal exposed a robustness hole in the round-1 web code. cleanedTaskIds is destructured from the archive response, so a response that omits it (the deeplink test's generic mock returns an array) made formatDependencyCleanupMessage throw - previously harmless because it happened after the modal had closed and the refresh had run, but with the report moved first it wedged the dialog open and timed out the existing 'archives a routed task with a single history close' test, which then cascaded through every later JSDOM file in the process. reportDependencyCleanup now treats the list as wire data and reports nothing when it is absent. All 266 web tests pass in 6s.

Gate results: bunx tsc --noEmit and bun run check . clean; bun run test 2819 pass / 8 skip / 1 fail, the one failure being 'BacklogServer statistics endpoint > reconciles a selected backlog root before reading its statistics', which passes in isolation and also flaked in an earlier round before any of these changes. Another run of the same tree failed a different single MCP test that likewise passes in isolation - the machine was running a second worktree's suite concurrently for part of this session.

Fail-closed round (PR 987, two findings):

1. Completed cleanup dissolved contested identities (src/core/backlog.ts, src/core/content-store.ts). writeVacatedIdCleanup refreshed the rewritten completed record with transitionTask(id, record), which filters BOTH store corpora by taskIdsEqual and re-adds only the completed copy - so cleaning a completed record evicted an active file claiming the same ID, and later in-process reads stopped seeing the conflict. The refresh is now ContentStore.refreshCompletedTask(task), scoped to the record's file path: it replaces that path's entry in the completed corpus and drops that same path from the active one (the shared saveTask publication writes every file as an active record), leaving any other claimant of the ID exactly where it was. transitionTask keeps its identity-wide semantics for archive, complete and demote, where the record really did leave the active corpus.

2. Reference cleanup compared spellings, not identities (src/utils/task-links.ts). isExactTaskReference ended in a normalizeTaskId string comparison, so a reference written TASK-01 against a target stored as TASK-1 was left in place while the dependency list holding the same identity was cleaned. It now keeps both prefix guards - a bare number, a doc, draft or decision ID still never matches a task - and compares with taskIdsEqual, the same identity the dependency filter and task resolution use. The existing references test still pins that '1', 'JIRA-1', 'task-12', a URL and a path containing the ID all survive.

Other literal comparisons in the cleanup path: checked, none left. collectVacatedIdCleanup filters with taskIdsEqual, withVacatedIdCleanup builds its lock-coverage set with canonicalTaskId, withoutVacatedTaskLinks now uses taskIdsEqual for both lists, and stringArraysEqual only detects whether a list changed. One literal comparison exists just outside it: FileSystem.withTaskLocks dedupes and derives its lock key from the ID spelling lowercased, so two spellings of one identity would key two lock files. It is not a misbinding risk here - the lock protects a file path and every spelling in this path comes from one normalized read - and changing it would touch shared locking, so it is left alone and recorded here.

Both tests fail on the pre-fix tree (verified by stashing the three source files): the padded-reference test reports cleanedTaskIds [] instead of [TASK-1] and leaves the reference to rebind once the allocator reissues the ID, and the contested-identity test finds the active duplicate's path gone from the store's active corpus. Full gates green on a quiet machine: bunx tsc --noEmit, bun run check ., bun run test 2822 pass / 8 skip / 0 fail.

Final round (PR 987, three findings):

1. Cleanup wrote active dependents through updateTask, which re-resolves the record with fs.loadTask and throws AmbiguousTaskIdError when another file claims the same normalized ID. Because archive and demote vacate the target before the cleanup runs, that failed the operation after the ID was already free. writeVacatedIdCleanup now writes every record - active and completed - to the path the scan selected, with fs.saveTask (which preserves filePath and skips ID resolution), sets updatedDate itself, publishes each record explicitly (upsertTask for active, refreshCompletedTask for completed) and wraps the loop in batchTaskUpdates so the whole cleanup still notifies once. Pre-fix the new test failed with 'AmbiguousTaskIdError: Task ID TASK-2 is ambiguous; 2 files match' raised from updateTask inside writeVacatedIdCleanup.

2. Archive had no moved signal. Chose the signal over rolling the move back. Reasons: demote already established this shape in round 2, so archive matching it keeps one meaning across the two operations rather than two recovery stories; a rollback would restore the target while leaving the dependents the cleanup already rewrote, so a live task would be missing references that were removed on its behalf - a second inconsistency traded for the first; and the rollback move can itself fail, which needs its own report. The moved state is also the truthful one: the file really is in the archive, and a stale reference to an archived ID renders as an unknown task ID rather than binding to anything. archiveTask now wraps everything after the successful move and tags the failure archiveState 'moved' through the shared markRecordAlreadyMoved helper (demoteTask's two inline tags now use it too). The server's DELETE handler reports it, broadcasts a refresh, and the web client closes the dialog, refreshes and says what happened. apiClient.archiveTask also stops retrying, exactly as demote does not retry: a retried DELETE would target the task the first attempt archived and its 404 would replace the real outcome.

3. task edit <id> -s Draft had the same gap: the draft was saved and the task file unlinked, then a failing cleanup escaped as an ordinary error. demoteTaskWithUpdates now tags demotionState 'moved' for anything after the create-lock block, and the server's PUT handler reports it and broadcasts, matching the demote endpoint. The web edit surface cannot reach this path (Draft is not offered as a status for a task), so no client change was needed there.

Web helper consolidation: readMovedFailureState in src/web/lib/api.ts is now the single reader for the marker, used by App's archive handler and by TaskDetailsModal's demotion handler.

Pre-fix evidence: the three new tests fail on the previous commit (verified by stashing the source files) - the contested-identity dependent aborts with AmbiguousTaskIdError, and the injected cleanup write failure leaves archiveState and demotionState undefined on the archive and edit-to-Draft paths. The failures are injected by replacing FileSystem.saveTask for one task ID, so they are deterministic and carry no filesystem permission behaviour that could differ on CI. Gates on a quiet machine: bunx tsc --noEmit and bun run check . clean, bun run test 2825 pass / 8 skip / 0 fail, statistics endpoint included.

Follow-up lock-key round: re-verified all production task-lock callers. They are vacated-ID cleanup, single-task update, and bulk update; none relies on equivalent spellings taking different locks. Task lock files, multi-lock deduplication, and ordering now use canonical task identity. Draft locks remain separately namespaced with unchanged identity rules. Cleanup lock coverage now uses taskIdsEqual, matching the scan.

MCP task_edit now receives cleanedTaskIds from editTaskOrDraft and reports dependent cleanup on edit-to-Draft. Post-move demotion failures carry cleanup versus commit cause through the server so the task modal gives the right recovery guidance. Archive recovery warns before refresh.

Four new regressions failed on the pre-fix tree and pass after the fixes. Changed test files: 38 pass / 0 fail; non-network atomic task-lock tests: 9 pass / 0 fail. bunx tsc --noEmit and bun run check . pass. The required bun run test command was attempted, but this managed sandbox blocks localhost listeners with EPERM and cannot write the worktree's external Git common lock directory; watcher tests also time out here, so a trustworthy full-suite total could not be produced in this environment.

Scope cut (maintainer steer, 2026-09-01): the shared task-lock keying change was removed. Canonicalizing lock keys in FileSystem.withEntityFileLock and withTaskLocks changed behavior for every caller of task locking in order to close a multi-process interleaving that needs a task stored as a bare number, completed mid-operation, with a second archive running concurrently. That is disproportionate for a local single-user tool, and this branch showed full-suite instability that main does not. What remains is what the reported bug needs: references cleaned on archive, demote and edit-to-Draft across the working copy and the completed corpus, written by path, reported to the user, with canonical taskIdsEqual comparison so padded spellings like TASK-01 are matched. Known limitation, also noted on Core.withVacatedIdCleanup: the coverage check and the acquired lock key can disagree for equivalent-but-differently-spelled IDs under concurrent mutation, so that interleaving can still leave a stale reference. It renders as an unknown task ID rather than binding to anything until the allocator reissues the number.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The vacated-ID cleanup now uses canonical task lock keys across active and completed spellings, reports cleanup from MCP task_edit demotions, distinguishes cleanup from commit failures in web recovery guidance, and warns about an already-archived task before refreshing. Four deterministic regressions fail on the pre-fix tree and all changed test files pass (38 pass, 0 fail); the non-network atomic lock tests pass (9 pass, 0 fail), and TypeScript plus Biome are clean. The managed sandbox blocks localhost listeners, external Git-common-directory writes, and filesystem watcher delivery, so the full suite and requested local commit must be completed in an unrestricted worktree before merge.
<!-- SECTION:FINAL_SUMMARY:END -->
