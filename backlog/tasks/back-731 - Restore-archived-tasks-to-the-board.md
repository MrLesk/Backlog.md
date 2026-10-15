---
id: BACK-731
title: Restore archived tasks to the board
status: Done
assignee:
  - '@codex-731'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-15 21:05'
labels:
  - enhancement
dependencies:
  - BACK-730
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
  - core
  - commands
  - mcp-tools
  - src/core/content-store.ts
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
  - src/test/content-store.test.ts
  - src/core/content-store.ts
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
Repair plan after approved architecture review (2026-10-15):
1. Integrate exact repaired BACK-730 parent 5cdbc0a7 while retaining its deletion locks through commit, preflight, applied-change errors, MCP translation, and earlier archive/exclusive-create repairs.
2. Make ContentStore.transitionTask accept the complete resulting active or archived task, or no task for removal. Clear the identity from both corpora, install the result in the correct corpus, rebuild identity/visible tasks, and publish once. Keep refreshArchivedTask path-based so contested identities remain contested.
3. Replace restoreTask removal plus upsert with one transition carrying the restored local task. Keep existing archive/delete call semantics and accepted move, refusal, link, and commit behavior.
4. Add a regression using Core.restoreTask with an initialized store. Check every published snapshot, active/archived membership, identity resolution, and one publication. Retain archive/delete and contested archived-file coverage.
5. Run focused restore, content-store, identity/cache, read-only, delete/autocommit, and MCP checks with Bun 1.4.3 and Biome 2.5.15, canonical type/lint commands, build, and compiled CLI/MCP smoke. Review the task diff for simpler code and unrelated changes. Hold In Progress without final repair commit or push for a full-context architecture review.

6. Architecture review accepted the repair unchanged. Record objective evidence, finalize the verified task, commit the reviewed files, and push the final head with an explicit remote-head lease.
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

Final repair verification (2026-10-15):
- Integrated exact repaired BACK-730 parent 5cdbc0a7 at merge commit ac252cbd. The deletion body matches the parent apart from the loader operation argument required by restore. Its lock span, auto-commit preflight, deletionApplied tracking, phase errors, TaskDeletionAppliedError, and MCP translation are preserved. The earlier archive and exclusive-create repairs are retained.
- ContentStore.transitionTask now installs the complete resulting active or archived task, or removes the identity when no task remains. Core.restoreTask publishes the restored local task through one transition. refreshArchivedTask remains path-based and preserves contested identities.
- The real Core restore regression failed with two publications before the repair. It passes with one complete publication afterward, checking the visible snapshot, active corpus, empty archived corpus, and read/mutation identity results.
- AC 1-3: cli-task-restore tests and the compiled CLI smoke verify byte-preserving restore with the same ID/status/name, normal list/edit after restore, and the archived read-only refusal naming restore. The suite also covers ambiguity, destination conflicts, linked files, legacy completed folders, and auto-commit.
- AC 4: mcp-tasks and mcp-server tests plus a compiled MCP stdio smoke verify the existing task_restore tool and task_view after restore.
- AC 5: cli-guidance, cli-doctor, and mcp-server tests verify help, shipped lifecycle guidance, and restore advice.
- 358 tests passed across 21 focused suites, including content-store, restore, archive/delete, identity/cache, read-only, commit scope, vacated references, MCP, and exclusive creation. Bun 1.4.3; Biome 2.5.15. Canonical bun run check:types, bun run check ., and bun run build passed. The existing literal TypeScript Definition of Done also passed with the installed compiler via bunx --no-install tsc --noEmit.
- Task-scoped subtraction and the full-context architecture review are complete: keep the repair, no blocker, no further simplification, and no new product decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog task restore <id> returns an archived task to the board with the same ID, status, filename, and file bytes. Restored tasks can be listed and edited; archived edits remain refused with the restore command. Existing CLI and MCP restore behavior, move conflicts, linked-file handling, and scoped auto-commit behavior are preserved.

Restore now publishes one complete active state through ContentStore.transitionTask. Subscribers no longer receive a temporary snapshot where the restored task is absent. Archive/delete transitions and path-based archived refresh retain their separate meanings, including contested identity handling.

Verified with a regression that reproduced two publications before the repair and one complete publication afterward; 358 focused tests across 21 suites; canonical type/lint/build checks; the installed tsc check; and compiled CLI/MCP smoke. The repaired parent deletion boundary and earlier archive/exclusive-create repairs are retained. Architecture review found no blocker or further simplification. Hosted PR checks remain separate from this local verification.
<!-- SECTION:FINAL_SUMMARY:END -->
