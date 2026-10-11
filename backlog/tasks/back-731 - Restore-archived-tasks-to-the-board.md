---
id: BACK-731
title: Restore archived tasks to the board
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-11 20:17'
labels:
  - enhancement
dependencies:
  - BACK-730
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
  - core
  - commands
  - mcp-tools
modified_files:
  - src/cli.ts
  - src/core/archived-task-move.ts
  - src/core/backlog.ts
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
  - src/test/cli-doctor.test.ts
  - src/test/cli-guidance.test.ts
  - src/test/mcp-server.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/server-cleanup-endpoint.test.ts
  - src/test/tui-task-lifecycle.test.ts
  - src/test/cli-task-restore.test.ts
priority: high
type: enhancement
ordinal: 349000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1064 reports that finished work taken off the board can still be viewed but can no longer be edited or returned to the board (reproduced on 1.53.0). Editing such a task answers that the task was not found, and no command leads back, so the only way out is editing task files by hand, which the shipped guidance forbids.

BACK-719 makes archive the single way off the board and keeps the task ID, but it does not add a way back. Restore is the supported way back. Archived tasks stay read-only, so changing one means restoring it first.

The CLI is the canonical surface for restore. An MCP equivalent is planned alongside it and is confirmed on the pull request. If it is declined, the MCP criterion is dropped.

Depends on BACK-730: the lifecycle change is delivered in order, first the single archive flow (BACK-719), then delete (BACK-730), then restore.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog task restore <id>` on an archived task exits zero and moves the task back to the board with the same ID.
- [x] #2 A restored task behaves like any other task on the board: `backlog task list` shows it and `backlog task edit <id>` changes it.
- [x] #3 Archived tasks stay read-only: `backlog task edit <id>` on an archived task exits non-zero, leaves the task unchanged, and prints a message that names the restore command instead of reporting that the task was not found.
- [x] #4 The MCP server offers the same operation.
- [x] #5 Command help and the shipped instruction guides (`backlog instructions`) describe how to bring archived work back to the board.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Layer 3 of the stack (branch tasks/back-731-task-restore on top of BACK-730). The MCP tool is confirmed by the maintainer and is built like the MCP delete tool.

1. Core (src/core/backlog.ts): one operation, `Core.restoreTask(taskId, autoCommit?)`.
   - It loads the archived record with the same archived-only loader delete uses, so an ID that more than one record claims fails closed as ambiguous, a task that is already on the board throws the typed `TaskNotArchivedError`, and an unknown ID reports not found.
   - Under the task lock it re-reads the record and moves the file from the folder it is archived in (`archive/tasks` or a leftover `completed/`) to the tasks folder under the same file name, with the no-replace move layer 1 built for `doctor --fix` (a hard link or a recreated symlink, then unlink), so an existing board file is never overwritten and a symlinked task file stays a link to the same target. The file content is not rewritten: the task keeps its ID and the status it had.
   - Auto-commit follows the project setting, like archive.
   - `TaskArchivedError`, the one message every surface shows when a change targets an archived task, now names the restore command.

2. CLI (src/cli.ts): `backlog task restore <taskId>` with no options, built like `task archive` and `task delete`. The `doctor` advice for self-referential and cyclic dependencies on archived tasks points at restore instead of editing the file by hand.

3. MCP (src/mcp/tools/tasks/*): a `task_restore` tool with the one-ID input, calling the same core operation and translating the typed refusal.

4. Guides and docs: the CLI and MCP guides, agent-guidelines, the project-manager guideline, README and CLI-INSTRUCTIONS say how to bring archived work back to the board and that an archived task must be restored before it can be changed.

5. Tests through the public surfaces: CLI (restore keeps ID and status, list shows it and edit changes it, edit on an archived task names restore, restore on a board task and on an unknown ID fails and changes nothing, ambiguous ID fails closed, never replaces an existing board file, leftover `completed/` folder, symlinked archived file, auto-commit) and MCP (`task_restore` under the same rules), plus the tool list, guides and help.

6. Verification: scoped tests, `bunx tsc --noEmit`, `bun run check .`, and a scripted end-to-end run of every acceptance criterion against a binary built from this layer in a private mktemp project.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on tasks/back-731-task-restore, stacked on BACK-730. The MCP tool was confirmed by the maintainer and is built like the MCP delete tool.

Core: `Core.restoreTask(taskId, autoCommit?)` is the one operation. It loads the record with the archived-only loader delete uses (`loadArchivedTask`), so an ID that two records claim fails closed as ambiguous, a task already on the board throws `TaskNotArchivedError` ("Task X is not archived. It is already on the board.") and an unknown ID returns false. Under the task lock it re-reads the record and moves the file from the folder it is archived in (`archive/tasks` or a leftover `completed/`) to the tasks folder under the same name, with the no-replace move layer 1 built for `doctor --fix` (`moveWithoutReplacing`: a hard link or a recreated symlink, then unlink). A board file with that name is never replaced; restore then fails with "Task X cannot be restored: the board already has a file named ...". A symlinked task file stays a link to the same target. The file is not rewritten, so the task keeps its ID and the status it had. Auto-commit follows the project setting.

Read-only message: `TaskArchivedError`, the one message every surface shows when a change targets an archived task, now reads "Task X is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore X". `TaskNotArchivedError` takes the consequence for its caller, so delete and restore share the loader and each keeps its own second sentence.

Adapters: `backlog task restore <taskId>` has no options and is built like `task archive` and `task delete`. The MCP `task_restore` tool takes the one-ID input, calls the same core operation, translates the typed refusal and returns the task detail like `task_archive`. No TUI or browser control was added. `backlog doctor` now tells users to restore an archived task before rewriting its dependencies instead of editing the file directly.

Guides and docs: the CLI and MCP overview and finalization guides, the MCP tool reference, agent-guidelines, the project-manager guideline, README and CLI-INSTRUCTIONS say how archived work comes back to the board and that an archived task is restored before it is changed.

Tests: src/test/cli-task-restore.test.ts drives the CLI for every acceptance criterion plus restore on a board task and an unknown ID, an ambiguous ID, an existing board file with the same name, a leftover `completed/` folder, absolute and relative symlinked archived files, and auto-commit; src/test/mcp-tasks.test.ts drives `task_restore`; the MCP tool list, the MCP guides, the CLI help and guides and the doctor advice are asserted. The restore tests keep their projects outside the repository.

Verification: `bunx tsc --noEmit` clean; `bun run check .` clean (435 files); scoped tests pass (cli-task-restore, cli-task-delete, cli-doctor, mcp-tasks, mcp-server, cli-guidance, tui-task-lifecycle, server-cleanup-endpoint, cli-task-state, core, archived-task-folders: 223 pass, 0 fail). A scripted end-to-end run against a binary built from this layer covered every acceptance criterion through the CLI and through MCP over stdio in private mktemp projects.

Review round: TaskNotArchivedError takes the operation (delete or restore) and holds both sentences itself. Archive and restore move the task file through one private helper, moveTaskFile, which uses the shared no-replace move and throws the typed TaskFileExistsError for either direction ('...cannot be archived: the archive already has a file named...' or '...cannot be restored: the board already has a file named...'). Restore resolves a task that exists only on another branch to the same typed refusal as archive and delete. All typed refusals extend TaskRefusedError, so the MCP restore handler is the same three lines as delete, and its tool is declared beside the delete tool above the registration block. commitFailedAfter documents when to use it and when to tag the error instead.

Third review round: an ID that several records claim on another branch fails closed as ambiguous for restore too; a test calls Core.restoreTask directly for that case. Every acceptance criterion was re-run end to end against a binary built from this layer's tip (CLI and MCP over stdio) in private mktemp projects.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task restore <id>` moves an archived task back to the board with the same ID and the status it had. Archived tasks stay read-only, and the message a refused change gets now names the restore command, so archived work is no longer a dead end (issue #1064).

What changed
- One core operation, `Core.restoreTask`. It moves the file from the folder it is archived in (`archive/tasks` or a leftover `completed/`) to the tasks folder under the same name and does not rewrite it. A task that is already on the board is refused with "Task X is not archived. It is already on the board.", a task that exists only on another branch is refused as read-only, and an ID that more than one record claims fails closed as ambiguous.
- Archive and restore move the task file through one helper built on the shared no-replace move. A file of the same name in the destination is never replaced; the operation is refused with a typed error and changes nothing. A symlinked task file stays a link to the same target.
- `TaskArchivedError`, the one message every interface shows when a change targets an archived task, reads "Task X is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore X".
- `backlog task restore <taskId>` has no options. The MCP server offers the same operation as `task_restore`. The TUI and the browser get no restore control.
- `backlog doctor` tells users to restore an archived task before rewriting its dependencies, instead of editing the file directly.
- Help, the CLI and MCP guides, README and CLI-INSTRUCTIONS say how archived work comes back to the board.

Verification
- `bunx tsc --noEmit` and `bun run check .` are clean; the scoped tests pass, including src/test/cli-task-restore.test.ts, which drives the CLI for every acceptance criterion, and the MCP tests for `task_restore`.
- A scripted end-to-end run against a binary built from this layer covered every acceptance criterion through the CLI and through MCP over stdio.

Choices to confirm
- The MCP `task_restore` tool is included, as ruled by the maintainer.
- The archived message names the CLI command on every interface, including MCP and HTTP.
<!-- SECTION:FINAL_SUMMARY:END -->
