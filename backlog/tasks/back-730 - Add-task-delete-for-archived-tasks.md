---
id: BACK-730
title: Add task delete for archived tasks
status: Done
assignee:
  - '@codex-730-v2'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-15 21:45'
labels:
  - enhancement
dependencies:
  - BACK-719
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
  - core
  - commands
  - mcp-tools
  - dependencies
  - src/core/backlog.ts
  - src/test/cli-task-delete.test.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/mcp-tasks.test.ts
  - src/file-system/operations.ts
  - src/test/vacated-task-references.test.ts
modified_files:
  - src/core/backlog.ts
  - src/utils/dependency-graph.ts
  - src/utils/task-links.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/index.ts
  - src/mcp/tools/tasks/schemas.ts
  - .claude/agents/project-manager-backlog.md
  - CLI-INSTRUCTIONS.md
  - README.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-finalization.md
  - src/test/cli-guidance.test.ts
  - src/test/cli-task-delete.test.ts
  - src/test/mcp-server.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/test-utils.ts
  - src/file-system/operations.ts
  - src/test/vacated-task-references.test.ts
  - src/test/cli-released-id-draft-links.test.ts
priority: high
type: enhancement
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md has no proper way to delete a task. Archive used to act as a soft delete: it released the task ID, and a task that was brought back got a new one. BACK-719 changes archive so that it keeps the ID, which leaves no way to remove a task for good or to free its ID (maintainer direction on issue #1064).

Delete is the explicit second step that releases an ID, and it only works on a task that is already archived. Archiving is the confirmation step, which is why delete itself has no prompt and no confirmation flag.

The CLI is the canonical surface for delete, and the MCP server offers the same operation. The TUI and browser do not get a delete control in this task.

Depends on BACK-719: delete acts on the archive that task leaves in place, where every archived task keeps its ID.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog task delete <id>` on an archived task exits zero and permanently removes that task from the project, so `backlog task view <id>` no longer finds it.
- [x] #2 `backlog task delete <id>` on a task that is not archived exits non-zero with an error saying the task must be archived first, and leaves the task unchanged.
- [x] #3 `backlog task delete <id>` runs without a prompt and offers no confirmation flag.
- [x] #4 Deleting an archived task releases its ID, so the ID is no longer reserved and can be assigned to a newly created task.
- [x] #5 Delete removes incoming dependencies and references to the deleted task from other tasks, and its output names the tasks that were changed.
- [x] #6 Delete is refused while subtask records of the task still exist: it exits non-zero with an error that says so, and leaves the task and its subtasks unchanged.
- [x] #7 The MCP server offers the same delete operation with the same rules as the CLI.
- [x] #8 Command help and the shipped instruction guides (`backlog instructions`) describe the two-step archive-then-delete deletion.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved bounded locking revision on existing PR #1095, starting at exact head 5cdbc0a7f6444fcefe58168f23ea8c1ba7417bf7 and retaining exact BACK-719 parent 647ecc1f548be38d719423667b92381b9eb4f8a7. No newer main changes or restore feature are included.

1. Make withVacatedIdCleanup own the existing allocator/create lock after task and draft locks. Perform its final cleanup rescan inside that lock; if new candidates appear, release every lock and retry with the wider set.
2. Remove the nested allocator spans in deleteTask, demoteTaskWithUpdates and FileSystem.demoteTask. Preserve current mutation, cleanup, commit and applied-error behavior, including delete holding allocator through unlink/staging/commit.
3. Coordinate Core.archiveTask membership moves using its task lock followed by the same allocator lock. Reread the current ID under the locks and preserve byte-preserving, no-overwrite archive behavior. BACK-731 will separately integrate restore.
4. Add deterministic actual-operation regressions for a create completing immediately before allocator acquisition and a child archive attempted between the two corpus enumerations. Prove cleaned links after ID reuse, parent refusal, and shared demote/edit-to-Draft behavior.
5. Run focused cleanup/delete/MCP/allocator/archive/demotion and commit-scope suites, canonical Bun 1.4.3 types, Biome 2.5.15, build, diff check and compiled CLI/MCP smoke. Preserve all prior race/error regressions.
6. Make a task-scoped subtraction pass and leave work In Progress for full-context read-only review. No task finalization, commit, push or public review actions in this implementation pass.

7. After full-context KEEP review and Alex's finalization approval, record current AC/DoD evidence and summary, mark Done, commit the reviewed bounded revision, push with protection against remote head 5cdbc0a7, and return clean main without merging any PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-730-task-delete, stacked on BACK-719. Restore (BACK-731) is not started and nothing here names it.

Core: `Core.deleteTask(taskId, autoCommit?)` is the one operation. It resolves the ID against the working copy with the read resolver layer 1 uses (`loadWorkingCopyTask`), so an ID that two records claim fails closed as ambiguous. A task on the board throws `TaskNotArchivedError` ("Task X is not archived. A task must be archived before it can be deleted.") and an unknown ID returns `success: false`. The delete runs inside the existing `withVacatedIdCleanup`, which locks the record and every task that references it. Inside the locks it re-reads the record, throws `TaskHasSubtasksError` while a task on the board or in the archive names it as parent (`findDirectSubtasks`), writes the cleaned referencing records, and removes the file last with `unlink`, so a failure leaves the task in the archive and the delete can be run again. A symlinked task file is removed as a link; its target stays. The ID is released because the record leaves the identity corpus. The result is the existing `VacatedTaskResult`, reported with the existing `formatDependencyCleanupMessage` line. Auto-commit follows the project setting and commits the removal together with the cleaned tasks.

Adapters: `backlog task delete <taskId>` has no options and no prompt and is built like `task archive`: resolve the ID locally for the confirmation line, call core, print "Deleted task X" and the cleanup line; typed errors reach the CLI's top-level handler. The MCP `task_delete` tool takes the same one-ID input as `task_archive`, calls the same core operation and translates the two typed refusals. Neither adapter checks eligibility itself.

Guides and docs: the CLI and MCP overview and finalization guides, the MCP tool reference, agent-guidelines, the project-manager guideline, README and CLI-INSTRUCTIONS describe deleting as archive first, then delete, and say that delete releases the ID and removes incoming links.

Tests: src/test/cli-task-delete.test.ts drives the CLI for every acceptance criterion plus an ambiguous ID, a symlinked archived file and auto-commit; src/test/mcp-tasks.test.ts drives `task_delete` through the same rules; the MCP tool list, the MCP guides and the CLI help and guides are asserted. The delete tests keep their projects outside the repository (`createTestDirOutsideRepository`): the CLI finds its project by walking up from the working directory, and under a machine load above 200 a CLI process that outlived its timed-out test directory under the repository's tmp/ resolved the repository's own backlog, created a stray task and deleted one archived record there. Both were reverted before anything was committed.

Choices taken conservatively and listed for review: a subtask is a task on the board or in the archive whose parent field names the task, the relation every surface shows; a draft that was demoted from a subtask and a dotted ID without a parent field do not block the delete. A task that exists only on another branch reports "not found", because delete reads the working copy only.

Verification: `bunx tsc --noEmit` clean; `bun run check .` clean (434 files); scoped tests pass (cli-task-delete, mcp-tasks, mcp-server, cli-guidance, cli-task-state, vacated-task-references: 112 pass, 0 fail). A scripted end-to-end run against a binary built from this layer covered every acceptance criterion through the CLI and through MCP over stdio in private mktemp projects, including the ambiguous-ID refusal and a symlinked archived file.

Review round: delete resolves a task that exists only on another branch, on its board or in its archive, to the same typed refusal as archive (TaskOnOtherBranchError through the shared refuseTaskOnOtherBranch); MCP reports it like every other TaskRefusedError, and the CLI, which reads the working copy only, keeps its not-found line with the hint. The typed delete refusals extend TaskRefusedError, the MCP handler runs through runLifecycleOperation, and an unknown ID reads 'Task X not found.' on both interfaces. Help and the CLI and MCP guides now say that references held by drafts are not changed, because the cleanup covers tasks only.

Third review round: an ID that several records claim on another branch fails closed as ambiguous for delete too, through the shared refuseTaskOnOtherBranch; a test calls Core.deleteTask directly for that case. Every acceptance criterion was re-run end to end against a binary built from this layer's tip (CLI and MCP over stdio) in private mktemp projects.

Review fix after the pull request was opened (one finding of the automated review on #1095, verified).

Delete no longer reports success when the removal could not be staged. With auto-commit on, `deleteTask` staged the removed file with a catch that ignored every error, because `git add` of a missing file that was never committed fails. The same catch hid real failures: with the repository index held by another process the removal was not staged, the commit step found nothing staged and returned, and `backlog task delete` printed "Deleted task" and exited 0 while nothing was committed. The removal is now staged only when the path has an entry in the index (`getIndexEntries`, the helper the commit code already uses), and a staging error reaches the existing failure path: "Task X was deleted, but committing the change failed: <reason>", exit code 1. A task file that was never committed is still deleted without a commit and without an error.

Tests in src/test/cli-task-delete.test.ts, in a repository outside this one: with `.git/index.lock` present, deleting an archived and committed task that nothing refers to exits 1 with that message, prints no "Deleted task", leaves no file on disk and adds no commit (before the fix this test fails with exit code 0); deleting an archived task that was never committed exits 0 and adds no commit. End to end against the built CLI with the index lock present: before the fix exit 0 and "Deleted task TASK-1" with the removal left uncommitted; after it exit 1 and the message with Git's lock error.

Verification: `bunx tsc --noEmit` and `bun run check .` are clean; the scoped tests pass.

Two maintainer rulings applied.

A draft that still names the task as its parent blocks the delete, like a subtask on the board or in the archive. A subtask that is demoted becomes a draft that keeps its parent field, and promoting it gives it a subtask ID built on the parent's ID again, so deleting the parent in between would release an ID that draft still depends on. `Core.deleteTask` reads the drafts together with the board and the archive and runs the one subtask check (`findDirectSubtasks`, the parent field) over all three; the refusal lists the draft's ID with the others: "Task TASK-1 cannot be deleted while its subtasks exist: DRAFT-1." The CLI and the MCP tool call the same function. Tests in src/test/cli-task-delete.test.ts: with a demoted subtask and the parent archived, delete exits 1, names the draft and changes neither file; after the draft is promoted, archived and deleted the parent is deleted; and once the draft's parent field is cleared the delete succeeds and the draft stays. With drafts left out of the check the refusal test fails with exit code 0. Help, the MCP tool description, the CLI and MCP overview guides and CLI-INSTRUCTIONS now say that a task whose subtasks still exist, as tasks or as drafts, is not deleted. A dotted ID without a parent field still does not block the delete.

The ID release is qualified everywhere it is stated: the ID is released once no other branch or worktree still holds the task. Changed sentences: the `task delete` description and help, the `task_delete` tool description, the CLI and MCP overview and task-finalization guides, README and CLI-INSTRUCTIONS. Behavior did not change. The tests that pin these sentences (src/test/cli-guidance.test.ts, src/test/mcp-server.test.ts, src/test/mcp-tasks.test.ts) now require the qualified wording.

Verification: `bunx tsc --noEmit` and `bun run check .` are clean; the scoped tests pass.

Maintainer ruling: the cleanup that runs when a task ID is released also covers drafts.

A draft that depended on or referred to a task kept that link when the task was deleted or demoted, and once the ID was handed to the next created task the draft pointed at that unrelated task. The shared vacated-ID cleanup in `Core` (`collectVacatedIdCleanup`, `withVacatedIdCleanup`, `writeVacatedIdCleanup`) now handles drafts next to board and archived tasks, for every operation that uses it: `deleteTask`, `demoteTask`, and an edit into the Draft status. There is no separate draft pass.

- Scan: the drafts are read with the tasks, and the same link rule applies (`withoutVacatedTaskLinks`), so a URL that merely contains the ID is not a link.
- Locks: the draft locks are taken with the operation's task locks, tasks first and then drafts, each kind sorted (`FileSystem.withDraftLocks`, the draft counterpart of `withTaskLocks`). They are the locks a draft edit takes, so the two exclude each other. The scan is repeated inside the locks and widens as before. A draft that another process is editing, or that was renamed between the scan and the locks, makes the operation fail before anything changed, as a task in that state does.
- Write: a draft is saved through `FileSystem.saveDraft`, the save every draft update uses, bound to the ID its file name gives it. That save names the file after the draft's ID and title, so a draft file that was named otherwise is saved under the new name; the old path is returned with the written paths and its removal is staged when Git tracks it (`stageChangedPath`, which also replaces the inline check delete had).
- Result: `cleanedTaskIds` names the cleaned drafts with the cleaned tasks. `backlog task delete`, `backlog task demote`, the MCP tools and the HTTP demote response report them through the existing "Removed references to X from ..." line and field; no adapter changed.
- A draft whose ID does not resolve to exactly the file it was read from is left as it is: a damaged file, a file whose name and frontmatter disagree, or an ID that two draft files claim. A draft edit refuses these too, saving one would remove the other claimant, and `backlog doctor` reports them.
- A draft that names the task as its parent still blocks the delete; this change is about dependencies and references only.

Demote: the only change is that a draft holding a link is cleaned and named in the output. Everything else about demote is the same, and its existing tests pass unchanged.

The change is in this layer and not in BACK-719: the delete operation and every sentence that had to change live here, and the shared cleanup's code is the same in both layers, so nothing made the lower layer the only clean place.

Wording: the sentence "References held by drafts are not changed: the cleanup covers tasks only." is gone from the `task delete` help, the CLI and MCP overview guides and CLI-INSTRUCTIONS; those places, the `task_delete` tool description and the two task-finalization guides now say that the links other tasks and drafts hold are removed, and that the changed tasks and drafts are named.

Tests: src/test/cli-released-id-draft-links.test.ts drives the CLI for delete and for demote: a draft with a dependency on and a reference to the task has neither afterwards, the output names the draft, a draft whose only link is a URL containing the ID is byte for byte unchanged, and the task created next receives the released ID without the draft linking to it. Both cases fail on the previous tip (816d0c8b). src/test/vacated-task-references.test.ts covers the locking for drafts (an edit between the scan and the locks is kept, a draft that starts linking in that window is cleaned, a renamed or locked draft fails the operation with nothing changed, a contested draft ID is left alone). src/test/cli-task-delete.test.ts checks that auto-commit commits a cleaned draft, including one whose file gets a new name, and leaves a clean working tree. The MCP delete test names the cleaned draft, and the tests that pinned the old sentences pin the new ones.

Verification: `bunx tsc --noEmit` and `bun run check .` are clean; the scoped tests pass (25 files). End to end against the built CLI, for delete and for demote: before, the draft still listed TASK-1 as a dependency and a reference after the ID had been reused; after, both are gone, the URL stays, and the command prints "Removed references to TASK-1 from DRAFT-1".

2026-10-15: repaired the two verified review findings on PR #1095 after integrating exact BACK-719 parent 647ecc1f.

Delete now reads shouldAutoCommit before mutation, takes the allocator/create lock inside the existing task and draft cleanup locks, and holds it across unlink, staging and commit. It sets deletionApplied immediately after unlink. A separate failure step preserves the difference between a commit failure and a release failure after a successful commit. Existing stageChangedPath and commitFiles still scope the commit.

Compiled MCP smoke found that its generic error boundary hid the applied-deletion message. One TaskDeletionAppliedError in Core now passes through the existing lifecycle translator as OPERATION_FAILED. This narrow adapter repair is part of the approved CLI/MCP outcome. No general recovery layer was added.

Seven new deterministic cases have failure-before/fix-after evidence: create attempts at staging and commit boundaries; task-lock release failure with auto-commit off and on; auto-commit settings read before mutation; MCP commit failure; and MCP allocator-lock release failure after a successful commit. The original staging case committed the concurrently recreated task as an R100 rename. The repaired case commits only the archived file removal, then allows the same ID and filename to be reused afterwards.

Current acceptance evidence:
1. cli-task-delete tests and compiled CLI/MCP smoke verify archived deletion and the subsequent not-found result.
2. cli-task-delete and mcp-tasks tests verify active-task refusal and unchanged files.
3. cli-task-delete verifies noninteractive deletion, help options, and rejection of confirmation flags.
4. cli-task-delete, cli-released-id-draft-links, id-generation, atomic-task-create and worktree-task-id-allocation verify ID reuse and reservations; the new race tests verify the same ID/path stays unavailable until the delete commit finishes.
5. CLI/MCP delete and released-ID draft tests verify task and draft link cleanup, reporting, preserved URL references, and scoped commit contents.
6. CLI/MCP tests verify refusal while parent-linked subtasks remain on the board, in the archive, or as drafts; clearing the explicit parent relation permits deletion.
7. mcp-tasks and compiled MCP over stdio verify the same deletion rules and useful applied-deletion errors.
8. cli-guidance and mcp-server tests verify archive-then-delete help and shipped instructions.

Verification used Bun 1.4.3 and Biome 2.5.15. All 18 selected suites completed: cli-task-delete, mcp-tasks, mcp-server, vacated-task-references, cli-released-id-draft-links, atomic-task-create, atomic-task-edit, id-generation, worktree-task-id-allocation, task-identity-index, task-id-resolution, core-autocommit-scope, task-autocommit-index-scope, draft-lifecycle-autocommit-scope, auto-commit, cli-task-state, cli-create-preserves-existing-files, and cli-guidance. The final affected CLI/MCP batch passed 78 tests; the allocator/cleanup/delete batch passed 113 tests. Existing atomic-edit HTTP tests required sandbox escalation to bind a local port; its remaining four cases then passed.

The current canonical type check is bun run check:types (Bun built-in checker per DEVELOPMENT.md): no errors in 545 files. bun run check . passed on 442 files. bun run build and git diff --check passed. Compiled CLI and MCP smoke passed in a private temporary project, including archive with auto-commit off then delete with it on, task/draft cleanup, scoped commits, ID reuse, not-found results, and an applied-deletion staging failure message through MCP. One existing released-ID test needed only Biome formatting after the parent toolchain update.

The task-scoped subtraction pass kept the existing owners and helpers, removed the old post-lock deletion-result staging block, and left only one empty typed error plus its existing adapter translation. Full-context architecture review recommended KEEP with no blocker or new decision. Alex authorized finalization and the protected push. No PR was remotely merged.

2026-10-15: Alex approved one bounded architecture revision after deterministic probes on 5cdbc0a7 confirmed two existing membership-coordination gaps (also present at original b8799436): PRRT_kwDOO2LIE86s93SG permits a CLI create after final cleanup scan but before allocator acquisition, leaving links that rebind after ID reuse; PRRT_kwDOO2LIE86s93ST permits a child archive between active/archive enumerations, allowing parent deletion. The repair moves final validation into the existing allocator boundary and coordinates archive membership moves there. Both boundaries remain approved: commands act on the current record by ID under its lock, and arbitrary relationship edits after the final scan retain the documented limitation. The file-instance identity request PRRT_kwDOO2LIE86s93Sb does not change behavior. Prior staging/commit and applied-deletion repairs remain intact. No new task or lock framework is needed.

Bounded revision implemented and ready for full-context review (not finalized).

withVacatedIdCleanup now owns the allocator lock after the sorted task and draft locks. Its final cleanup scan and the mutation callback run inside that allocator span. Discovering new task or draft candidates returns out of every lock wrapper before retrying. The three former inner allocator acquisitions in deleteTask, demoteTaskWithUpdates and FileSystem.demoteTask were removed; FileSystem.demoteTask is an internal move whose only production caller already owns these locks. Core.archiveTask now holds its task lock and then the allocator across reread, byte-preserving no-overwrite move, content-store publication and existing commit. Restore remains in BACK-731. ID-based rereads and the documented limit for arbitrary relationship edits outside the locked set remain unchanged.

Four deterministic cases failed on the old source, then passed with this revision. A CLI create completing immediately before allocator acquisition left its links untouched before; now cleanup widens, removes both links, reports the late task, commits exactly the archived removal and changed task, and permits later ID reuse without rebinding. A real child archive between archive/active enumerations let deletion remove the parent before; now the archive attempt is excluded, parent deletion refuses, both records remain byte-identical, and archive then child deletion then parent deletion succeeds. Direct demote and edit-to-Draft each clean a late-created task and draft, preserve edits, and reuse the released task ID without stale links.

Verification: 321 distinct tests in 21 selected suites passed: cli-task-delete, vacated-task-references, mcp-tasks, cli-released-id-draft-links, atomic-task-create, atomic-task-edit, id-generation, worktree-task-id-allocation, cli-task-state, draft-lifecycle-autocommit-scope, filesystem, task-identity-index, task-id-resolution, core-autocommit-scope, task-autocommit-index-scope, auto-commit, cli-guidance, mcp-server, archived-task-folders, references, cli-create-preserves-existing-files. Existing atomic-edit HTTP cases needed permission to bind local ports; raw FileSystem promotion fixtures needed permission to write the discovered repository allocator lock under .git. Both environment-only reruns passed; no code was changed for the sandbox. Bun 1.4.3 check:types passed on 545 files; Biome 2.5.15 passed on 442 files; build and git diff --check passed. The compiled CLI/MCP smoke in private temporary projects passed archive-off/delete-on commit scoping, task/draft cleanup, missing-task results, ID reuse and MCP applied-deletion staging errors.

Subtraction pass: retained the one existing cleanup owner and lock system; removed nested allocator wrappers and their temporary return object, without adding helpers, lock flags or new state in production. No further source changes are planned. HEAD remains 5cdbc0a7, exact BACK-719 ancestry is preserved, and unrelated tasks/back-767-parallel-workflows remains a017677f. BACK-730 stays In Progress for read-only review. No finalization, commit, push or public review action was performed.

Final verification and review for the approved bounded revision:
AC1: cli-task-delete and compiled CLI/MCP smoke passed archived deletion and subsequent view-not-found.
AC2: CLI/MCP tests passed active-task refusal with unchanged files.
AC3: CLI tests passed noninteractive deletion, help options and rejection of confirmation flags.
AC4: allocator/worktree/identity suites and four red-to-green races passed; later creates reuse the released ID, while staging/commit races keep it unavailable until delete finishes.
AC5: CLI/MCP and released-ID draft tests passed task/draft link removal and reporting; the late-create regression proves exact scoped commit contents and no links to the replacement task.
AC6: CLI/MCP tests passed refusal for explicit parent-linked active tasks, archived tasks and drafts; the child archive regression preserves both records and permits parent deletion only after its child is deleted.
AC7: MCP suite and compiled stdio smoke passed the same delete rules, scoped commits and applied-deletion failures.
AC8: cli-guidance and mcp-server suites passed archive-then-delete help and shipped instructions.
DoD1: the current canonical type check is bun run check:types per DEVELOPMENT.md, replacing the legacy tsc command named by this older task item; Bun 1.4.3 passed on 545 files.
DoD2: bun run check . passed with Biome 2.5.15 on 442 files.
DoD3: 321 distinct tests across 21 selected suites passed, including the prior deletion race/error/MCP regressions. Sandbox-only local port and repository allocator-lock access failures were inspected and the affected cases passed with required access.
Build, git diff --check and compiled CLI/MCP smoke passed. Four new deterministic regressions have failure-before/fix-after evidence. Source hashes match the reviewed files.
Task-scoped subtraction and full-context architecture review both recommend KEEP. There is no blocker, new decision or further source change. Alex authorized finalization and the protected push. Both approved boundaries remain: commands reread the current ID under its lock; arbitrary relationship edits outside the locked set after the final scan retain their documented limitation. Restore coordination will be integrated in BACK-731. Parent and dependent merges remain held.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added archive-then-delete task removal through the canonical CLI and MCP. Delete removes incoming task and draft links, names changed records, refuses explicit parent-linked subtasks, and releases the ID once no branch or worktree still holds it.

The shared cleanup now owns task, draft and allocator locks through final validation and mutation. Wider retries release every lock before reacquiring. Archive shares the allocator boundary, so a child cannot disappear between active/archive scans. Delete retains the allocator through unlink, scoped staging and commit, with accurate applied-deletion errors through CLI and MCP. Current-ID rereads and the documented late relationship-edit limit remain unchanged.

Four new deterministic regressions failed before the revision and passed after it. All 321 tests in 21 selected suites, canonical Bun types, Biome, build, diff check and compiled CLI/MCP smoke passed. Subtraction and full-context architecture review recommended KEEP with no blocker or new decision. BACK-731 will integrate restore coordination.
<!-- SECTION:FINAL_SUMMARY:END -->
