---
id: BACK-730
title: Add task delete for archived tasks
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-12 06:16'
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
Layer 2 of the stack (branch tasks/back-730-task-delete on top of BACK-719). Restore is BACK-731 and is not named by any command, help text, guide or message here.

1. Core (src/core/backlog.ts): one operation, `Core.deleteTask(taskId, autoCommit?)`.
   - It resolves the ID against the working copy with the read resolver layer 1 already uses, so an ID that more than one record claims fails closed as ambiguous. A task on the board throws a typed `TaskNotArchivedError` ("must be archived first"); an unknown ID reports not found.
   - It runs inside the existing vacated-ID cleanup (`withVacatedIdCleanup`), which locks the record and every task that references it. Inside the locks it re-reads the record, refuses with a typed `TaskHasSubtasksError` while a board or archived task names it as parent (the existing `findDirectSubtasks` relation), writes the cleaned referencing records first and removes the file last, so a failure leaves the task in place and the delete can be retried.
   - The file is removed with `unlink`, which removes a symlinked task file as a link and leaves its target alone. The ID is released because the record leaves the identity corpus; no separate reservation list exists. Auto-commit follows the project setting like the other lifecycle operations.
   - Returns the existing `VacatedTaskResult`, so the changed tasks are reported with the existing `formatDependencyCleanupMessage` line.

2. CLI (src/cli.ts): `backlog task delete <taskId>` with no options and no prompt, built like `task archive` and `task demote`: resolve the ID locally, call core, print the confirmation and the cleanup line. Typed errors reach the existing top-level handler. Help schema describes archive-then-delete.

3. MCP (src/mcp/tools/tasks/*): a `task_delete` tool with the same one-ID input as `task_archive`; the handler calls the same core operation and translates the two typed errors.

4. Guides and docs (src/guidelines/cli-instructions/*, src/guidelines/mcp/*, src/guidelines/agent-guidelines.md, README.md, CLI-INSTRUCTIONS.md): deleting a task is two steps, archive then delete; delete releases the ID and removes incoming links.

5. Tests through the public surfaces: CLI (delete archived, refuse board task, no flag and no prompt, ID reuse, links removed and reported, subtasks refuse, ambiguous ID fails closed, symlinked archived file leaves its target, auto-commit) and MCP (same rules through `task_delete`), plus the guide and tool-list expectations.

6. Verification: scoped tests, `bunx tsc --noEmit`, `bun run check .`, and a scripted end-to-end run of every acceptance criterion against a binary built from this layer in a private mktemp project.
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task delete <id>` permanently removes an archived task and releases its ID once no other branch or worktree still holds the task. Archiving keeps the ID since BACK-719, so delete is the explicit second step for work that should leave no record (issue #1064).

What changed
- One core operation, `Core.deleteTask`. It only acts on an archived task: a task on the board is refused with "Task X is not archived. A task must be archived before it can be deleted.", and a task that exists only on another branch is refused as read-only. An ID that more than one record claims fails closed as ambiguous.
- Delete is refused while a task on the board, a task in the archive or a draft names the task as its parent, because subtask IDs are built on the ID that would be released and a demoted subtask is promoted back to such an ID. The refusal lists those tasks and drafts.
- Delete removes the dependencies and references that tasks on the board, tasks in the archive and drafts hold to the task, through the shared vacated-ID cleanup, and reports the changed tasks and drafts. The referencing records are written first and the file is removed last, so a failure leaves the task in the archive and the delete can be run again. Demote uses the same cleanup, so it cleans and reports drafts in the same way; nothing else about demote changed.
- A symlinked archived task is removed as a link; the file it points to stays. Auto-commit commits the removal together with the cleaned tasks; when the removal cannot be staged or committed, the command says that the task was deleted but the commit failed and exits non-zero.
- `backlog task delete <taskId>` has no options and no prompt, because archiving is the confirming step. The MCP server offers the same operation as `task_delete` with the same rules. The TUI and the browser get no delete control.
- Help, the CLI and MCP guides, README and CLI-INSTRUCTIONS describe deleting as archive first, then delete, and say that the ID is released once no other branch or worktree still holds the task.

Verification
- `bunx tsc --noEmit` and `bun run check .` are clean; the scoped tests pass, including src/test/cli-task-delete.test.ts, which drives the CLI for every acceptance criterion, and the MCP tests for `task_delete`.
- A scripted end-to-end run against a binary built from this layer covered every acceptance criterion through the CLI and through MCP over stdio.

Choices to confirm
- The subtask check follows the parent field only. A dotted ID without a parent field does not block the delete.
- A draft that a draft edit would refuse (a damaged file, a file whose name and frontmatter disagree, or an ID two draft files claim) is not rewritten by the cleanup and keeps its links. `backlog doctor` reports such drafts.
<!-- SECTION:FINAL_SUMMARY:END -->
