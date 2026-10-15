---
id: BACK-730
title: Add task delete for archived tasks
status: Done
assignee:
  - '@codex-730'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-15 20:57'
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
Final solution on existing PR #1095, preserving its original commits and integrating BACK-719 at 647ecc1f548be38d719423667b92381b9eb4f8a7 through merge 76fc5d7a918f669838b8cdbe5b34e33289c34d29.

1. Keep deleteTask in Core and retain the existing task, draft, then allocator/create lock order. Read shouldAutoCommit before mutation.
2. Hold the allocator lock across unlink, staging and commit. Preserve the existing stageChangedPath and commitFiles path scoping, including archive without auto-commit followed by delete with auto-commit.
3. Record successful unlink immediately, independently of the current failure step. Report applied deletion accurately for later commit or lock-release failure.
4. Pass only the typed TaskDeletionAppliedError through the existing MCP lifecycle translator as OPERATION_FAILED. Keep successful commit and later release failure distinct.
5. Prove the staging/commit race and applied-deletion errors with deterministic regressions and actual commit contents. Verify CLI/MCP delete, allocator, cleanup and auto-commit suites, canonical types, Biome, build and compiled smoke.
6. Complete the subtraction pass and full-context architecture review. The review recommended KEEP without a blocker, new product decision, or worthwhile task-scoped simplification.
7. Record objective evidence, mark verified work Done, commit only this task, and push its final reviewed head with protection against a changed remote head. Leave the parent unmerged and preserve unrelated branches.
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added archive-then-delete task removal through the canonical CLI and MCP. Delete removes incoming task and draft links, reports changed records, refuses explicit parent-linked subtasks, and releases the ID once no branch or worktree still holds it. Linked task files keep their established link semantics.

The reviewed repair holds the allocator lock from before unlink through staging and commit, so a concurrent create cannot enter the delete commit. Deletion is recorded immediately after unlink. CLI and MCP errors say that deletion already happened and distinguish a failed commit from a later lock-release failure, including when the commit succeeded.

Seven new deterministic regressions passed after demonstrating the original failures. The 18 focused suites, canonical Bun type check, Biome, build, diff check, and compiled CLI/MCP smoke passed. The full-context architecture review recommended KEEP without a blocker or new product decision. Existing parent-field subtask rules and damaged-draft cleanup boundaries remain as documented.
<!-- SECTION:FINAL_SUMMARY:END -->
