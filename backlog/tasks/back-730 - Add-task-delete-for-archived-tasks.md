---
id: BACK-730
title: Add task delete for archived tasks
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-11 19:14'
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
- [ ] #1 `backlog task delete <id>` on an archived task exits zero and permanently removes that task from the project, so `backlog task view <id>` no longer finds it.
- [ ] #2 `backlog task delete <id>` on a task that is not archived exits non-zero with an error saying the task must be archived first, and leaves the task unchanged.
- [ ] #3 `backlog task delete <id>` runs without a prompt and offers no confirmation flag.
- [ ] #4 Deleting an archived task releases its ID, so the ID is no longer reserved and can be assigned to a newly created task.
- [ ] #5 Delete removes incoming dependencies and references to the deleted task from other tasks, and its output names the tasks that were changed.
- [ ] #6 Delete is refused while subtask records of the task still exist: it exits non-zero with an error that says so, and leaves the task and its subtasks unchanged.
- [ ] #7 The MCP server offers the same delete operation with the same rules as the CLI.
- [ ] #8 Command help and the shipped instruction guides (`backlog instructions`) describe the two-step archive-then-delete deletion.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
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
<!-- SECTION:NOTES:END -->
