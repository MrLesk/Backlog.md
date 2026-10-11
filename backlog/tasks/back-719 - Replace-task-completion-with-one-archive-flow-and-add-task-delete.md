---
id: BACK-719
title: Replace task completion with one archive flow
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:42'
updated_date: '2026-10-11 16:03'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
  - core
  - file-storage
  - task-identity
  - content-store
  - dependencies
  - commands
  - mcp-tools
  - web-server
  - task-details
  - terminal-board
modified_files:
  - src/constants/index.ts
  - src/file-system/operations.ts
  - src/utils/task-path.ts
  - src/types/index.ts
  - src/core/cross-branch-tasks.ts
  - src/core/task-loader.ts
  - src/core/task-identity-index.ts
  - src/core/content-store.ts
  - src/core/backlog.ts
  - src/utils/task-record-index.ts
  - src/utils/readiness.ts
  - src/utils/dependency-graph.ts
  - src/formatters/dependency-graph-text.ts
  - src/core/task-detail.ts
  - src/utils/task-builders.ts
  - src/core/duplicate-task-repair.ts
  - src/core/archived-task-move.ts
  - src/core/statistics.ts
  - src/cli.ts
  - src/formatters/task-plain-text.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/mcp/tools/tasks/index.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/ui/task-lifecycle.ts
  - src/ui/board.ts
  - src/ui/components/help-popup.ts
  - src/ui/task-viewer-with-search.ts
  - scripts/benchmark-task-loading.ts
  - src/web/utils/kanban-tasks.ts
  - src/web/lib/api.ts
  - src/web/App.tsx
  - src/web/components/CleanupModal.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/Statistics.tsx
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/task-finalization.md
  - src/guidelines/agent-guidelines.md
  - README.md
  - CLI-INSTRUCTIONS.md
  - src/test/mcp-task-complete.test.ts
  - src/test/tui-task-lifecycle.test.ts
  - src/test/id-generation.test.ts
  - src/test/worktree-task-id-allocation.test.ts
  - src/test/cleanup.test.ts
  - src/test/cli-task-state.test.ts
  - src/test/vacated-task-references.test.ts
  - src/test/auto-commit.test.ts
  - src/test/board-popup-sync.test.ts
  - src/test/cli-custom-prefix-id-resolution.test.ts
  - src/test/cli-dependency-graph.test.ts
  - src/test/cli-dependency.test.ts
  - src/test/cli-doctor.test.ts
  - src/test/cli-guidance.test.ts
  - src/test/cli-json-output.test.ts
  - src/test/cli-json-watch.test.ts
  - src/test/cli-missing-storage-directories.test.ts
  - src/test/cli-parent-filter.test.ts
  - src/test/cli-task-list.test.ts
  - src/test/content-store.test.ts
  - src/test/core-autocommit-scope.test.ts
  - src/test/core-task-corpus-regressions.test.ts
  - src/test/core.test.ts
  - src/test/dependency-graph-surfaces.test.tsx
  - src/test/dependency-graph.test.ts
  - src/test/dependency.test.ts
  - src/test/duplicate-task-repair.test.ts
  - src/test/filesystem-task-cache.test.ts
  - src/test/filesystem.test.ts
  - src/test/kanban-tasks.test.ts
  - src/test/local-task-command-performance.test.ts
  - src/test/mcp-server.test.ts
  - src/test/mcp-tasks-local-filter.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/readiness-surface-agreement.test.ts
  - src/test/readiness.test.tsx
  - src/test/references.test.ts
  - src/test/server-cleanup-endpoint.test.ts
  - src/test/server-duplicate-repair.test.ts
  - src/test/server-loading-progress.test.ts
  - src/test/server-statistics-endpoint.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/test/statistics.test.ts
  - src/test/task-search-parity.test.ts
  - src/test/test-utils.ts
  - src/test/unified-view-filters.test.ts
  - src/test/unified-view-loading.test.ts
  - src/test/utc-date-display.test.ts
  - src/test/web-app-open-detail-refresh.test.tsx
  - src/test/web-dependency-graph-section.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/test/web-task-details-modal-demote.test.tsx
  - src/test/web-task-details-modal-keyboard-shortcuts.test.tsx
  - src/test/web-task-readiness-badge.test.tsx
  - src/ui/footer-content.ts
  - src/utils/task-links.ts
  - src/web/utils/milestones.test.ts
  - src/test/archived-task-folders.test.ts
  - src/test/task-identity-index.test.ts
  - src/test/web-dependency-cleanup-notice.test.tsx
  - src/test/no-remote-preflight.test.ts
  - src/test/task-read-only.test.ts
  - src/completions/command-structure.ts
  - src/completions/helper.test.ts
priority: high
type: bug
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md has two ways to take a task off the board, and their names hide what they do. Complete moves a task in the final status to completed storage and keeps its ID, but a completed task can no longer be edited and no command restores it to the board (issue #1064, reproduced on 1.53.0). Archive behaves like a soft delete: it releases the task ID, and a task that is brought back gets a new one. Human and automated users confuse the two because of their names.

The maintainer's direction on the issue is a deliberate breaking change. Completion is removed in favor of a single archive flow that applies to every task, including tasks in the final status, and archiving keeps the task ID. This reverses the rule from BACK-691, under which archiving a task in the final status is rejected with guidance to use Complete. Deleting an archived task (BACK-730) and restoring one to the board (BACK-731) are the next layers and are not part of this task.

The CLI is the canonical surface for this lifecycle; the TUI, browser, and MCP follow the same rule.

Settled for this task: archiving never rewrites other tasks, and an archived dependency satisfies its dependents only when it holds the final status. Archived tasks are read-only and are marked as archived in task detail output and MCP search results. A leftover `completed/` folder is read as part of the archive until `backlog doctor --fix` moves it into `archive/tasks`; records that were already archived keep their IDs from now on, and an ID two records claim is reported and repaired by `backlog doctor`. `backlog cleanup` keeps its name and archives. Statistics count board tasks plus archived tasks in the final status.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog task complete` is no longer an available operation: it is absent from `backlog task --help`, and running it exits non-zero with one line saying the command was removed and to use `backlog task archive <id>`, without changing any task.
- [x] #2 `backlog task archive <id>` succeeds for a task in any status, including the configured final status.
- [x] #3 Archiving preserves the task ID: the archived task keeps its ID, and a task created afterwards is not assigned that ID.
- [x] #4 The TUI, browser, and MCP follow the same rule as the CLI: no separate complete action remains, and archive applies to a task in any status and preserves its ID.
- [x] #5 Command help and the shipped instruction guides (`backlog instructions`) describe the single archive flow and no longer direct users to a complete command.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved plan for this layer (plan review 2026-10-11). Delete is BACK-730 and restore is BACK-731; neither is named by any command, help text, guide or message here.

Design in one sentence: Archive takes over the mechanics completed storage had (the record stays in the identity corpus, keeps its ID, stays viewable and reserves its ID in allocation), and completed storage and the complete operation disappear. Whether archived work was finished is decided by its status, exactly as on the board.

1. Core storage and identity (src/constants/index.ts, src/file-system/operations.ts, src/utils/task-path.ts, src/core/task-identity-index.ts, src/core/cross-branch-tasks.ts, src/core/task-loader.ts, src/core/content-store.ts, src/core/task-detail.ts, src/utils/task-record-index.ts, src/types/index.ts)
   - Merge the lifecycle type `completed` into `archived`. `listArchivedTasks` is the one reader of the archived corpus: `archive/tasks` plus a leftover `completed/` folder, each real directory read once so symlinked folders and symlink cycles cannot duplicate or loop. Every other reader (identity index, ContentStore, task detail, dependency corpus, duplicate detection, watchers) goes through it or through the one directory list behind it. Remove `listCompletedTasks`, `completedDir`, both `completeTask` methods and the filesystem-level `archiveTask`. `backlog init` no longer creates `completed/`.
   - Read resolution (view) covers active and archived records. Mutation resolution stays active-only; a mutation aimed at an archived record fails with one shared "archived tasks are read-only" error from core. Ambiguity keeps failing closed.
   - Allocation: archived records count as occupied in the working copy, in sibling worktrees and in scanned branches, where a `completed/` path also maps to archived. Demotion is unchanged.

2. Core operations (src/core/backlog.ts, src/core/statistics.ts, src/utils/readiness.ts, src/utils/dependency-graph.ts, src/utils/task-builders.ts)
   - `archiveTask` accepts any status, moves the file to `archive/tasks` under the task lock, keeps the ID and rewrites no other record. Remove `completeTask` and `TaskArchiveStatusError`.
   - Finished means final status only: remove location as completion evidence from the record index, readiness and the dependency graph. An archived dependency satisfies dependents only in the final status; otherwise it keeps blocking.
   - Statistics count board tasks plus archived tasks in the final status through one helper shared by the CLI overview and the web endpoint.

3. Existing data (src/core/duplicate-task-repair.ts, src/cli.ts doctor)
   - Duplicate detection and repair cover the archived corpus. When records share an ID, the active one keeps it, then one from a leftover `completed/` folder; the other archived record is renumbered by `backlog doctor --fix` with references listed for review.
   - `backlog doctor` reports records left in `completed/`; `--fix` moves them into `archive/tasks` without changing IDs, never overwrites an existing file, and runs only once no duplicate IDs remain. This repository's own completed records are not moved in this pull request.

4. CLI (src/cli.ts): remove `task complete`; `task archive` works in any status with updated help; `cleanup` keeps its name and prompts and archives; `task view` marks an archived task; doctor and watch text stop naming completed storage.

5. MCP (src/mcp/tools/tasks/*): remove the `task_complete` tool and schema; `task_archive` follows the core rule; `task_search` marks archived results.

6. HTTP and browser (src/server/index.ts, src/web/*): remove the complete endpoint and button; archive becomes `POST /api/tasks/:id/archive`; the cleanup endpoints and modal archive; archived records open read-only; copy says the record, ID and links are kept.

7. TUI (src/ui/*): remove the C binding with its popups and help rows in the same commit; A archives a task in any status.

8. Guides and docs (src/guidelines/**, README.md, CLI-INSTRUCTIONS.md): one archive flow; no sentence points at a complete command. "Completed" stays where it means finished work.

9. Tests: delete the completion suites, rewrite the lifecycle suites, rename completed-corpus fixtures, and add coverage for archive in every status with the ID kept (working copy, worktree, branch), the read-only error, the leftover `completed/` folder including symlinked files, symlinked folders and a symlink cycle, the doctor move including an identical filename in both folders, and a legacy archived record that collides with an active ID.

10. Verification: simplification pass, `bunx tsc --noEmit`, `bun run check .`, `bun run test`, a scripted end-to-end run of every acceptance criterion against the CLI built from this branch in a private scratch directory, and a real exercise of the changed TUI and browser controls.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Layer 1 implemented on tasks/back-719-single-archive-flow (base origin/main 380b8f83). Delete (BACK-730) and restore (BACK-731) are not started and no command, help text, guide or message names them.

Core: the lifecycle type `completed` is merged into `archived`. `FileSystem.listArchivedTasks` is the one reader of the archived corpus and `FileSystem.getArchivedTaskDirs` is the one directory list behind it (`archive/tasks` plus a leftover `completed/`, each real directory once, missing directories skipped). The identity index, ContentStore, task detail, dependency corpus, duplicate detection, the task watcher and `task list --json --watch` all go through those two. `Core.archiveTask` accepts any status, moves the file under the task lock, keeps the ID and rewrites no other record; it returns a boolean. `completeTask` (core and filesystem), the filesystem-level `archiveTask`, `listCompletedTasks`, `completedDir`, `TaskArchiveStatusError` and the `completed` members of `TaskDirectoryType` and `Task.source` are deleted.

Read-only rule: `TaskIdentityIndex.resolveForMutation` reports an ID whose only working-copy record is archived as `archived`, and `Core.loadTaskForMutation` turns that into one `TaskArchivedError` ("Task X is archived. Archived tasks are read-only."). CLI, MCP and HTTP only translate it; the TUI editor path treats an archived task as read-only.

Finished means final status only: `TaskRecord.completedRecord` and the location-as-evidence rule are gone from the record index, readiness and the dependency graph. Statistics go through `selectStatisticsTasks` (board tasks plus archived tasks in the final status) in both the CLI overview and the web endpoint.

Allocation: archived records are live identity records, so they are occupied in the working copy, in sibling worktrees and in scanned branches; a `completed/` path on another branch maps to archived. No separate reservation list. Demotion is unchanged and is now the only caller of the vacated-ID cleanup.

Existing data: duplicate detection and `doctor --fix` cover the archived corpus; a board task keeps a contested ID, then a record in a leftover `completed/` folder, and the record in `archive/tasks` is renumbered. `src/core/archived-task-move.ts` previews and moves `completed/` records into `archive/tasks` (hard link or recreated symlink, so an existing file is never replaced; refused while duplicate IDs exist). `backlog doctor` reports them without failing and `--fix` runs the duplicate repair first, then the move. `backlog init` no longer creates `completed/`. This repository's own completed records were not moved.

Surfaces: `task complete`, the `task_complete` tool and schema, `POST /api/tasks/:id/complete`, the web "Move to completed" button and its C shortcut, and the TUI C binding with its popups, help rows and footer hints are removed. Archive is `POST /api/tasks/:id/archive` (no DELETE route archives). `cleanup` and the web cleanup keep their prompts and archive. `task view` and MCP task detail print `(archived)` on the status line, MCP search lines say `archived`, and the web modal and TUI detail show an archived task read-only with the existing read-only banner pattern.

Choices taken conservatively and listed for review: `backlog doctor` exits 0 when a leftover `completed/` folder is its only report; the dependency graph does not label an archived unfinished dependency as archived because that needs a new field in the versioned `--json` graph; the Groma architecture descriptions that still mention completed storage and `task_complete` were not edited.

Verification: `bunx tsc --noEmit` clean; `bun run check .` clean (432 files); `bun run test` 2892 pass, 8 skip, 0 fail across 290 files. The command still exits 1 because the unchanged src/test/list-window.test.ts leaves `process.exitCode` set (that file alone gives 8 pass, 0 fail, exit 1 on an export of origin/main too). An end-to-end script against a binary built from this branch covered every acceptance criterion in private mktemp projects (CLI, MCP over stdio, HTTP), including a leftover `completed/` folder, the doctor preview and `--fix`, and an archived record colliding with a board ID. The TUI was driven in a pseudo-terminal (board, task list, archived task detail) and the browser UI was exercised against the built binary (archive a Done and a To Do task, archived task opened read-only, readiness of dependents, cleanup modal copy, statistics).

Test changes: src/test/mcp-task-complete.test.ts deleted; vacated-task-references, id-generation, cleanup, server-cleanup-endpoint, cli-task-state, tui-task-lifecycle, cli-guidance and web-dependency-cleanup-notice rewritten for the new rules; src/test/archived-task-folders.test.ts added for the archived reader, the mover and collision repair with symlinked files, symlinked folders and link cycles; worktree and branch ID reservation added to worktree-task-id-allocation; the remaining suites only rename the completed corpus to the archived corpus.

Review round on layer 1 (second commit on the same branch, same message).

Read-only rule in one place: `isReadOnlyTask` in src/types (a task from another branch, or an archived task) is the predicate behind core's TUI edit path, the web modal and the TUI archive key. `isLocalEditableTask` is renamed `isWorkingCopyTask`, because it says where a record lives and not whether it can change (9 call sites, 4 imports, no behavior change).

TUI archive key: `archiveTaskFromTui` in src/ui/task-lifecycle.ts refuses a read-only task before it calls the view's confirm callback and returns a reason (`read_only`, `cancelled`, `failed`); `formatArchiveNotice` turns the result into the footer line. The board row key, the board popup key and the task list key call those two and keep only their own view update. A read-only task shows "Task is read-only." (plus " in branch X" for another branch), the same line the task list's E key shows.

No bypass: `Core.updateTask` resolves the stored record through the mutation resolver before it writes and throws `TaskArchivedError` for an archived record, with or without a loaded content store. The archived outcome of `TaskMutationResolution` carries only `taskId`. The four acceptance-criteria helpers on Core (add, remove, check, list) have no production caller and were left as they are.

Smaller changes: the archived-task mover uses `installFileNoReplace` for regular files; the redundant archived loop in `getOccupiedTaskIds` is gone (the identity index already lists archived records as occupied, and the id-generation suite passes without it); the doctor description names the archived move; the HTTP archive handler notes that `false` from core does not only mean missing; the web E shortcut and the read-only banner follow the one read-only flag, with one banner block whose reason text varies; the cleanup modal lost the two sentences that restated its label.

Tests: the two corpus-read counters in cli-task-list count the line the archived reader logs, and each has a positive control; both were confirmed to fail when the corpus is read for an empty result or read a second time for JSON. New cases cover the archive key on an archived task and on a task from another branch (in the helper and through the board's two key handlers), the archived banner in the TUI detail content, `Core.updateTask` on an archived record, the read-only predicate, and the web modal's read-only state for both reasons. Test names and fixtures that still said "completed" for archived data were renamed.

Verification of the round: `bunx tsc --noEmit` clean; `bun run check .` clean (433 files); `bun run test` 2908 pass, 8 skip, 0 fail across 291 files, still exiting 1 because of the unchanged list-window file. One earlier full run had a single failure in the unchanged test "ContentStore > publishes watched distinct-path local creation with the refreshed branch collision identity", which waits 3 seconds for a file-watcher event; that file passed alone 4 times out of 4 and the next full run was clean. A pseudo-terminal run of the rebuilt binary showed A on an archived task printing "Task is read-only." with no confirmation, while the board row, board popup and task list archive keys still ask and archive.

Left unchanged and listed for review: the board's E key says "Cannot edit task from branch X." for a task from another branch while the task list says "Task is read-only in branch X."; the Groma descriptions of backlog-folder, task-details, file-storage, terminal-widgets, core and mcp-tools still mention completed storage or `task_complete` and wait for a curation pass.

Close-out after the second review: `loadStoredTaskForWrite` documents what it resolves where and why it never initializes or refreshes the store; the board's E key shows the shared read-only line ("Task is read-only in branch X."), the same one the A key and the task list show; two comments were made precise. Every acceptance criterion was re-run end to end against a binary built from the branch tip (CLI, MCP over stdio, HTTP) in a private mktemp project.

Maintainer rulings applied after the reviews. (1) `backlog task complete` is answered by a removal notice: a hidden entry under `task` that accepts whatever follows its name, prints "backlog task complete was removed. Use backlog task archive <id>." and exits 1. It is not an alias, changes nothing, and is absent from `backlog task --help` and from shell completion (the completion structure now offers only the commands help lists). The removed MCP tool keeps the protocol's unknown-tool error. (2) One function for every interface: the CLI and MCP archive adapters no longer gate on the working copy with their own "another branch" message, core decides; cleanup runs through one core operation, `Core.archiveTerminalStatusTasksByAge`, in both `backlog cleanup` and the browser's cleanup endpoint, and the CLI counts finished tasks with the same core selector instead of its own status filter. The TUI asks the shared `isReadOnlyTask` predicate before it opens the confirmation and then calls `Core.archiveTask`; the browser hides the control with the same predicate. Left in the CLI adapter and listed for review: `backlog cleanup` stages the moved files for Git when auto-commit is off, which the browser's cleanup does not do.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completion is removed and Archive is the one way to take a task off the board (issue #1064, a deliberate breaking change).

What changed
- `backlog task archive <id>` works in every status, including the final one. The archived task keeps its ID, its record and every link other tasks hold to it, no other task is rewritten, and the ID is never handed out again (working copy, sibling worktrees and scanned branches).
- `backlog task complete`, the MCP `task_complete` tool, the HTTP complete route, the web "Move to completed" button and the TUI C key are gone. Running `backlog task complete` exits non-zero with one line saying the command was removed and to use `backlog task archive <id>`; it is not an alias, archives nothing and is absent from help and shell completion. `backlog cleanup` keeps its name and archives.
- Every interface runs the same core function: archive is `Core.archiveTask` for the CLI, MCP, HTTP and TUI, and cleanup is `Core.archiveTerminalStatusTasksByAge` for the CLI and the browser. No adapter decides what may be archived.
- Archived tasks are read-only everywhere through one core rule and one error ("Task X is archived. Archived tasks are read-only."). Task detail and MCP search output mark them as archived; the web modal and the TUI show the read-only banner and refuse edit and archive keys before asking anything.
- Finished means the final status only. An archived dependency satisfies its dependents only when it is in the final status, and statistics count board tasks plus archived tasks in the final status.
- Existing data: a leftover `completed/` folder is read as part of the archive. `backlog doctor` reports it and `--fix` moves it into `archive/tasks` without changing IDs or replacing files; an ID that two records claim is reported and repaired there, and fails closed until then.
- Help, README, CLI-INSTRUCTIONS and the shipped CLI and MCP guides describe the single archive flow.

Verification
- `bunx tsc --noEmit` and `bun run check .` are clean; `bun run test` has no failing test (the command still exits 1 because of the unchanged list-window test file, as on main).
- A scripted end-to-end run of every acceptance criterion against the built CLI (CLI, MCP over stdio, HTTP), a pseudo-terminal run of the TUI keys, and a browser session of the web controls.

Follow-ups and risks
- Scripts or agents that call `task complete` or `task_complete` must switch to archive.
- Deleting an archived task is BACK-730, restoring one is BACK-731, and the non-interactive cleanup failure is BACK-720.
- Left for review: the Groma descriptions of backlog-folder, task-details, file-storage, terminal-widgets, core and mcp-tools still mention completed storage or `task_complete`; `backlog doctor` exits 0 when a leftover `completed/` folder is its only report.
<!-- SECTION:FINAL_SUMMARY:END -->
