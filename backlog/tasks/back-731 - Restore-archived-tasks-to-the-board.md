---
id: BACK-731
title: Restore archived tasks to the board
status: Done
assignee:
  - '@codex-731-v2'
created_date: '2026-10-11 13:02'
updated_date: '2026-10-15 21:53'
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
  - src/file-system/operations.ts
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
  - src/file-system/operations.ts
  - src/test/cli-task-delete.test.ts
  - src/test/vacated-task-references.test.ts
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
Approved membership correction plan (2026-10-15):
1. Integrate exact revised BACK-730 parent 1fc5a50a, preserving task/draft/allocator order, final scan widening outside all wrappers, delete preflight/applied-change errors/commit scope, and demotion ownership. Resolve the shared Core conflict using the parent bodies plus the restore loader operation argument and existing moveTaskFile helper.
2. Wrap canonical restore reread, move, complete ContentStore transition and scoped commit in the existing allocator boundary inside the task lock, matching archive without nested acquisition or a new locking layer. Keep path-based refreshArchivedTask, by-ID mutation semantics and the documented arbitrary late relationship-edit limit.
3. Add one deterministic real Core restore/delete regression: freeze the active enumeration, attempt restoring an archived child before the archived enumeration, require parent refusal and retained records, then prove restore succeeds after the scan releases its boundary. Retain all existing parent race and deletion error tests.
4. Verify the one-publication Core restore test; restore CLI; ContentStore/identity; archive/delete/autocommit/MCP suites; canonical type/lint/build and compiled CLI/MCP smoke with Bun 1.4.3 and Biome 2.5.15. Inspect failures before reruns.
5. Review for subtraction and preserve this bounded scope. Hold stable code and evidence In Progress for full-context architecture review before final notes, Done, implementation commit or push.

6. Full-context review accepted the stable implementation unchanged. After the complete 460-test proof, root authorized finalization, the reviewed merge/repair commit, an explicit remote-head-protected push, and return to clean main. Preserve reviewed source/test hashes through precommit.
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

Reopened for the approved archive/restore membership correction (2026-10-15). Integrating exact revised BACK-730 parent 1fc5a50ac5073fd2d30b978f87e46018bf08df0c into existing BACK-731 head 5bb968fd399bb6561d6cc5a7035c734aa972c28d. The prior complete ContentStore publication repair remains required. The replacement-record review finding needs no code change: by-ID mutations reread the current ID and do not promise an original file instance. Hold In Progress for full-context architecture review; no final implementation commit or push yet.

Integrated parent source into the shared Core conflict: preserved the exact revised delete body with only the restore-aware loadArchivedTask delete argument, kept parent allocator ownership and demotion changes, and retained the existing moveTaskFile owner for archive bytes. Restore coordination and deterministic proof are the remaining focused changes.

Added the deterministic restore-direction eligibility regression in the existing CLI restore suite. It freezes the active snapshot, attempts real Core.restoreTask before the archived snapshot, checks real delete refusal/retained bytes and checks that restore succeeds afterward. Running it before the restore boundary change to verify that it reproduces the missed-child deletion.

Corrected the race fixture before product changes: the second in-allocator enumeration belongs to the target reread, so that timing still let the later eligibility scan see the restored child. The deterministic attempt now targets the third in-allocator enumeration, the actual parent eligibility scan after final cleanup scan and target reread.

The corrected eligibility-scan regression reproduced the bug before the change: Core.deleteTask resolved successfully while its existing archived child moved to the board between snapshots. Restore now takes the existing allocator inside its task lock and holds both across reread, shared moveTaskFile, complete transitionTask publication and scoped commit. The parent body and existing move/publication behavior are retained.

Validation progress for the approved membership correction:
- Bun 1.4.3 and Biome 2.5.15 confirmed. Canonical bun run check:types passed (546 files), bun run check . passed (443 files), build passed, and git diff --check is clean.
- Compiled CLI smoke passed byte-preserving restore with the same ID/status/name, archived read-only advice, list/edit, help and overview. Compiled MCP stdio smoke passed task_restore tool discovery, restore and restored task_view. The first smoke fixture used an incompatible init option combination; it was corrected before rerunning, with no product change.
- Confirmed by direct comparison that the exact parent delete body is retained apart from its two restore-aware loader operation arguments; FileSystem operations match exact parent 1fc5a50a.
- The broad test run produced 281 passing tests across 18 complete files before reaching sandbox-denied doctor fixtures. Their repository tmp projects discover the shared .git allocator, and the denial explicitly named .git/backlog.md/locks/create. Stopped the sandboxed runner and all its child processes, checked for unexpected tracked side effects (none), and reran only affected doctor/local HTTP fixtures with required access: 50 passed, 0 failed. Exclusive-create/move checks separately passed 38 tests across 2 files. ContentStore and delete files not reached in the interrupted run are now running separately.
- The contextual architecture review accepted the stable code unchanged: KEEP, no blocker, no further source simplification and no new product decision. Task remains In Progress pending complete proof and root authorization for finalization.

Membership correction proof is complete and code remains stable for the review hold:
- 460 distinct tests passed across 24 focused suites: 281 tests from 18 complete suites before the denied fixture run was stopped; all 23 delete tests; all 68 ContentStore tests; all 50 doctor/local-server tests; and 38 exclusive-create/move tests. The ContentStore watcher rerun required Git/remote-read access because the sandbox denied .git/FETCH_HEAD; it passed without source changes. Both denied test runners and their fixture children were stopped and verified exited.
- Parent create/archive/demotion race tests, deletion commit/release/config failure cases, MCP OPERATION_FAILED translation, restore CLI/link/conflict/status behavior, identity/cache, scoped commits, and the real Core one-publication restore case passed. The new deterministic restore regression failed before the wrapper because delete succeeded after missing the moved child, then passed with parent refusal, byte-identical retained records and eventual restore success.
- Canonical types, lint, build and compiled CLI/MCP smoke passed; installed bunx --no-install tsc --noEmit also passed. No unexpected tracked fixture side effects; git diff --check HEAD is clean.
- Subtraction review found no justified further code change: preserve the existing private byte-move helper, one complete transitionTask publication and existing allocator owner; add only the restore wrapper and its one regression. No new public surface or locking framework.
- Exact revised parent 1fc5a50ac5073fd2d30b978f87e46018bf08df0c remains pending in MERGE_HEAD over existing head 5bb968fd399bb6561d6cc5a7035c734aa972c28d. The integration is staged and focused repair/task notes remain unstaged. BACK-767 remains a017677fbb65daf954f9453b1320926d70604a25. Task stays In Progress, assigned @codex-731-v2, pending root authorization for finalization, final commit and protected push.

Finalization evidence for the membership correction (2026-10-15):
- AC 1: all CLI restore cases and the compiled CLI smoke passed same-ID, byte/status/name-preserving restore.
- AC 2: CLI restore tests and compiled smoke passed normal list and edit after restore.
- AC 3: CLI restore tests and compiled smoke passed archived edit refusal naming backlog task restore, with unchanged bytes.
- AC 4: MCP task/server suites and compiled MCP stdio smoke passed task_restore and restored task_view.
- AC 5: CLI guidance/doctor/MCP server suites and compiled help/overview smoke passed shipped restore guidance.
- DoD 1: canonical bun run check:types and installed bunx --no-install tsc --noEmit passed. DoD 2: canonical bun run check . passed with Biome 2.5.15. DoD 3: 460 distinct tests across 24 focused suites passed, including the new restore eligibility regression and retained parent race/error proofs. Build and compiled CLI/MCP smoke passed with Bun 1.4.3. Sandbox-only fixture failures were inspected and affected suites passed with required access; no fixture side effects or post-review source changes.
- Full-context review: KEEP, no blocker, no further source simplification and no new product decision. Root authorized the finalization, reviewed pending merge/repair commit and protected push after complete proof. All earlier feature commits and exact revised parent 1fc5a50ac5073fd2d30b978f87e46018bf08df0c are preserved.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog task restore <id> returns archived work to the board with the same ID, status, filename and bytes. Restored tasks can be listed and edited; archived edits name the restore command. CLI/MCP behavior, refusals, links and scoped auto-commit behavior are preserved.

Archive and restore now use the existing allocator boundary inside their task locks, so an existing child cannot move between the active and archived snapshots of a parent delete scan. Restore retains one complete ContentStore.transitionTask publication. The revised parent cleanup, widening, demotion and applied-deletion error behavior are preserved. By-ID mutations retain their current semantics and arbitrary late relationship edits retain their documented limit.

Verified with a deterministic regression that failed before the restore boundary and passed afterward, 460 tests across 24 focused suites, canonical type/lint/build checks, installed tsc and compiled CLI/MCP smoke. Sandbox-only fixture failures passed on targeted access reruns. Contextual review accepted the bounded implementation unchanged; no further product choice or source change was required.
<!-- SECTION:FINAL_SUMMARY:END -->
