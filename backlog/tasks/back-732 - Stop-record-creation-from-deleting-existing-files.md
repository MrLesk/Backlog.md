---
id: BACK-732
title: Stop record creation from deleting existing files
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 19:07'
updated_date: '2026-10-12 06:06'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
modified_files:
  - src/test/test-utils.ts
  - src/test/cli-create-preserves-existing-files.test.ts
  - src/utils/prefix-config.ts
  - src/utils/task-path.ts
  - src/core/backlog.ts
  - src/utils/id-generators.ts
  - src/file-system/operations.ts
  - src/test/content-store.test.ts
  - src/test/filesystem.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
  - src/test/duplicate-task-repair.test.ts
  - src/test/tui-task-composer.test.ts
  - src/core/content-store.ts
  - src/core/prefix-migration.ts
  - src/test/prefix-migration.test.ts
priority: high
type: bug
ordinal: 350000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Creating a task, document or decision can delete an existing file of the same kind. The command prints success and exits 0, so nothing tells the user that a record is gone. Both cases below were reproduced on main at 380b8f83.

Copied file. A file named with the next free number that carries another record's ID in its frontmatter is removed by the next create. With `task-1 - First.md` in place and a hand-made copy `task-2 - Copied-task.md` that still contains `id: TASK-1`, `backlog task create` allocates number 2 and deletes the copy. `backlog doc create` and `backlog decision create` do the same to the equivalent document and decision files. Before the create, `backlog doctor --fix` had listed that task file under "Repair is blocked: filename and frontmatter ID do not identify the same task", so the create removed a file that was waiting for a person to decide what to do with it.

Letter case. A stored ID in a different letter case is not counted when the next number is chosen. A decision whose frontmatter says `id: DECISION-1` is overlooked, the next `backlog decision create` hands out number 1 again and deletes the first decision's file. A document with `id: DOC-1` is lost the same way through `backlog doc create`. Tasks are not affected: a task ID written in lower case is still counted.

Two things combine here: the save step removes files whose name starts with the ID being written, whatever their frontmatter says, and the step that picks the next number overlooks IDs it should have counted. Found while reviewing the document and decision write paths for issue #1065.

Relationship to BACK-600: that task covers the same filename-based cleanup when an existing document or decision is updated (`backlog doc update` deleting a file whose frontmatter names a different document, and a decision update leaving two files for one ID), and it adds a `backlog doctor` finding for a file name that disagrees with its frontmatter ID. This task covers creation for all three record kinds, including tasks, which BACK-600 does not mention, and the letter case of stored IDs. It adds no doctor finding and does not change update behavior. Both tasks touch the document and decision save step, so the one that lands second builds on the first.

Settled during plan review: whether, in the copied-file case, create moves on to a number that no file uses or refuses with an error that names the conflicting file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a file named for the next free number that carries the ID of another record in its frontmatter (for example `task-2 - Copied-task.md` containing `id: TASK-1`), `backlog task create` leaves that file in place with its content unchanged.
- [x] #2 `backlog doc create` and `backlog decision create` leave the equivalent document and decision files in place with their content unchanged.
- [x] #3 With a decision whose frontmatter ID is written as `DECISION-1`, `backlog decision create` does not hand out number 1 again and the existing file is still present afterwards. The same holds for a document stored as `DOC-1` and `backlog doc create`.
- [x] #4 After any `task create`, `doc create` or `decision create` that exits 0, every file that existed before the command is still present with unchanged content, and the ID the command reports belongs to a file that did not exist before.
- [x] #5 If a create refuses to proceed because of a conflicting file, it exits non-zero, names that file and writes nothing.
- [x] #6 Tests cover the copied-file case for tasks, documents and decisions and the upper-case ID case for documents and decisions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Root causes (line numbers at origin/main 7140af6e; each scenario reproduced in scratch projects outside the repository)

Tasks
- Deletion: `saveTask` in src/file-system/operations.ts:817-829. For a task without `filePath` it asks `getTaskPath` (src/utils/task-path.ts:81-116) for "the existing file of this ID", which matches on the file name only, and unlinks that file when its name differs from the new one. Line 832 then writes the target with a plain overwrite.
- Allocator miss: `getActiveAndCompletedTaskIds` in src/core/backlog.ts:1607-1627 takes the local IDs from the identity index, which is keyed on frontmatter IDs. File names are read only by the worktree scan (`loadWorktreeTaskStateEntries`, 1545-1564), and that scan returns nothing outside a Git repository (1547) or when the project lies outside the repository root (1552). Inside a repository the scan of the current worktree counts the name and create already picks 3; in a plain folder `task-2 - Copied-task.md` with `id: TASK-1` contributes only TASK-1, number 2 is handed out and the copy is unlinked.

Documents
- Deletion: `saveDocument` in src/file-system/operations.ts:1518-1578. Lines 1530-1539 collect every file whose name starts with the document's ID. A new document has no `path`, so 1541-1544 adopts the first such file as its source, 1547-1558 renames it onto the new name, 1561-1572 unlink every other match and 1574 overwrites. When the stray file is a symlink the write goes through it and overwrites the linked file.
- Allocator miss: `generateNextDocId` in src/utils/id-generators.ts:8-74. Local numbers come only from frontmatter IDs (51-53) and are matched with the case-sensitive `/^doc-(\d+)$/` (58), so `DOC-1` is skipped and a file named `doc-2 - ...` holding `id: doc-1` counts as 1. File names are read only from the committed trees of branches (30-36).

Decisions
- Deletion: `saveDecision` in src/file-system/operations.ts:1483-1511. Lines 1492-1506 unlink every `decision-<n> -*` file other than the target, by name; 1508 overwrites.
- Allocator miss: `generateNextDecisionId` in src/utils/id-generators.ts:81-147, a copy of the document allocator: frontmatter IDs only (124-126), case-sensitive `/^decision-(\d+)$/` (131).

Behavior
- Skip, never refuse, when a stray file holds the next number: the new record gets one above the highest number found in any frontmatter ID or file name. The stray file is not read for intent and not touched.
- Refuse only when the file the new record would be written to already exists at write time (a name the scan cannot see, or a file that appears after allocation): the command fails, names the file and writes nothing.

Plan
1. Add `createTestDirOutsideRepository` to src/test/test-utils.ts with the name and body used on tasks/back-730-task-delete.
2. Write CLI tests first in src/test/cli-create-preserves-existing-files.test.ts, with projects outside the repository: copied file for tasks, documents and decisions; upper-case ID for documents and decisions; a symlinked record file with a link cycle in the folder; the refusal; a title change that must move only the record's own file. Assert the old file's bytes, the directory listing, the printed ID and the exit code. Confirm each fails on the unfixed code.
3. Which numbers are taken, in src/utils/prefix-config.ts: `generateNextId` stays the one place that reads the number out of an ID, in any letter case; add `extractIdFromFilename` as the one place that says which ID a file name claims. The draft twin of that helper in src/utils/task-path.ts delegates to it.
   - Tasks (src/core/backlog.ts): the file-name scan always covers this project's own tasks and completed folders, not only when Git lists worktrees.
   - Documents and decisions (src/utils/id-generators.ts): count the ID each local file name claims, including files that cannot be parsed, and pick the number with `generateNextId` in place of the two case-sensitive loops. Branch scanning is unchanged.
4. Saving removes no other file, in src/file-system/operations.ts: one private helper writes a record file for `saveTask`, `saveDocument` and `saveDecision`. The only existing file a save may replace is the one the record was loaded from (`filePath` for tasks, `path` for documents and decisions): rewritten in place, or moved when its name changed. A record that was not loaded from a file is new and its target must not exist. Delete the three name-matching cleanups.
5. Existing tests that re-save a hand-built record to stand for an update pass the loaded record or its path.
6. Run the scoped tests, `bunx tsc --noEmit` and `bun run check .`; simplify; record notes.

Overlap to confirm in review: creation and update share the save step, so step 4 also stops an update from removing or overwriting a file other than the one the record was loaded from. That covers BACK-600 acceptance criteria 1 and 2; its doctor finding and tests stay with BACK-600. No update caller changes.

Out of scope and left alone: draft saving, concurrent decision creation (BACK-734), merging the allocators (BACK-735), doctor.

Extension: drafts follow the same rule, so all four record kinds share one write rule

7. `saveDraft` writes through `writeRecordFile`. A draft loaded from a file rewrites that file or moves it when its name changes; a new draft's file is created only if the path is free. Delete the clean-up in `saveDraft` that removed other draft files by name.
8. Draft save callers: draft create, demote and the draft prefix migration save a new draft with a newly allocated number and no stored path; `draft edit` passes the path it loaded from. Demote and promote remove the source record's own file by the path it was loaded from; that already holds and stays.
9. Draft allocation: one FileSystem method returns the occupied draft IDs, which are the stored ID of every draft that can be read plus the ID each draft file name claims. Draft create, demote and the draft prefix migration all use it.
10. Delete the previous-file backup and restore in `createTaskFromInput` and `rollbackCreatedTask`; keep the Git index rollback. Rewrite the restore tests in tui-task-composer.test.ts to assert the refusal for tasks and drafts.
11. CLI tests for drafts, demote and promote in cli-create-preserves-existing-files.test.ts; pass the stored path in existing tests that re-save hand-built drafts.

12. Promote reports a failure with its own message: remove the catch-all in `Core.promoteDraft`, so "not found" means only that no draft file was found. At each place that clears `filePath` for a demote or a promote, say why it must be cleared.

Steps 7 to 11 supersede the earlier line that listed draft saving as out of scope. Still out of scope: concurrent decision creation (BACK-734), merging the allocators (BACK-735), doctor, and the archive move.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-732-create-never-deletes. Not pushed; no pull request yet.

Which numbers are taken
- src/utils/prefix-config.ts: `extractIdFromFilename` is the one place that says which ID a file name claims. `generateNextId` stays the one place that reads the number out of an ID and it ignores letter case.
- Tasks: `loadTaskFileNameEntries` in src/core/backlog.ts (was `loadWorktreeTaskStateEntries`) always reads this project's tasks and completed folders by file name; before it returned nothing outside a Git repository.
- Documents and decisions: src/utils/id-generators.ts counts the ID in each local file name, including files that cannot be parsed, and uses `generateNextId` in place of the two case-sensitive loops. Branch scanning is unchanged.

Saving removes no other file
- src/file-system/operations.ts: `writeRecordFile` writes the file for `saveTask`, `saveDocument` and `saveDecision`. The only existing file a save may replace is the one the record was loaded from (`filePath`, `path`): rewritten in place, or moved when its name changed. A record not loaded from a file is new and its file is created only if nothing is at that path.
- Deleted: the unlink of a same-number task file in `saveTask`, the file-name glob with rename and unlink loop in `saveDocument`, the file-name glob with unlink loop in `saveDecision`, `normalizeDraftId` in src/utils/task-path.ts, and the two max-number loops in id-generators.ts.

Behavior chosen
- A stray file on the next number is skipped: the new record gets one above the highest number in any frontmatter ID or file name. The stray file is not touched.
- Create refuses, with exit code 1, the file named and nothing written, only when the new file's own path is already taken. Reachable cases: an entry the folder listing does not return (a link whose target is missing, a directory of that name); for tasks and decisions a file whose name differs from the new one only in letter case on a case-insensitive file system; a file that appears between choosing the number and writing.

Tests
- New: src/test/cli-create-preserves-existing-files.test.ts (15 tests through the CLI, projects outside the repository). All fail on the unfixed sources.
- Changed to the final behavior: one test each in filesystem.test.ts, duplicate-task-repair.test.ts, tui-task-composer.test.ts. Tests that re-saved a hand-built record to stand for an update now pass the stored path: content-store.test.ts (12 tests), server-tasks-spa-fallback.test.ts, shared-branch-task-loader.test.ts.

For review
- Creation and update share the save step, so an update can no longer remove or overwrite a file other than the one it loaded. That covers BACK-600 acceptance criteria 1 and 2 (`doc update` no longer deletes a same-number file with another ID; a decision whose file name disagrees with its ID is moved, not duplicated). BACK-600 keeps the doctor finding and its tests.
- Two decision creates that race to the same number and title: one now fails with the refusal where before it silently replaced the other's file. Different titles still leave two files with one ID until BACK-734.
- Draft saving is unchanged. Draft creation already counted file names and was not affected by either scenario.
- A folder link inside docs that points back into docs makes every document reachable through two paths, so reads report the ID as ambiguous and `doc create` exits 1 after writing its file. This is the existing listing behavior and is not changed here.

Review follow-up
- Task create no longer looks up or reads a file to restore. The backup and restore in `createTaskFromInput` stay for drafts only: `saveDraft` still overwrites its target and removes superseded draft files by name, and removing the backup makes the two draft variants of the restore tests in tui-task-composer.test.ts fail. Deleting it completely needs draft saving to follow the same rule first.
- `saveDecision` strips the ID prefix with `extractIdBody`, in any letter case. A decision stored as `DECISION-1` keeps a `decision-1 - ...` file name when retitled; new test in cli-create-preserves-existing-files.test.ts.
- `saveDocument` and `saveDecision` return `movedFrom`, the previous path when the save moved the file, in place of `removedFilepaths`.
- The comment on `writeRecordFile` names the three save functions that use it and says drafts do not.
- Seen while testing, not changed: a decision with empty sections gets its section headings repeated when it is updated through `updateDecisionFromContent`. Same on origin/main.

Drafts follow the same rule (maintainer ruling: one behavior for tasks, drafts, documents and decisions)
- `saveDraft` writes through `writeRecordFile`, like the other three saves. A draft loaded from a file rewrites that file or moves it when its name changes; a new draft's file is created only if the path is free. The clean-up in `saveDraft` that removed other draft files by name is deleted.
- Draft save callers. New draft with a newly allocated number and no stored path: `task create --draft`, `draft create`, demote (`task demote`, an edit to status Draft), the draft prefix migration. Update with the path it was loaded from: `draft edit` and the edit paths behind MCP and HTTP. Demote and promote remove the source record's own file by the path it was loaded from; no name match is involved.
- Draft allocation: `listOccupiedDraftIds` returns the stored ID of every draft that can be read plus the ID each draft file name claims. Draft create, demote and the prefix migration use it. Before, one unreadable draft file made the allocator ignore every stored draft ID.
- Create flow in src/core/backlog.ts: the previous-file backup and restore is deleted (`previousPath`, `previousContent`, the lookups in `createTaskFromInput`, the three restore branches in `rollbackCreatedTask`). The Git index rollback stays. A create now adds one file or fails before writing.
- Tests: cli-create-preserves-existing-files.test.ts has 31 tests covering all four kinds, retitles, demote and promote. 24 fail on the sources of main; the other 7 cover draft and task cases that main already handled. The restore tests in tui-task-composer.test.ts are rewritten as four refusal tests (task and draft); all four fail on main.
- Acceptance criterion 4 now holds for every create command, including `task create --draft`.

Seen while testing, not changed
- `draft promote` reports any failed write, including a refused one, as "Draft not found". The draft is left in place.
- Archiving a task or a draft can replace a file of the same name already in the archive folder. Same on main, same for tasks and drafts.

Last review items
- `Core.promoteDraft` no longer turns every failure into "not found". The catch-all is removed, so `false` means only that no draft file was found and any other failure reaches the caller with its own message. `backlog draft promote` now prints the refusal when the new task's path is taken and leaves the draft in place; the HTTP endpoint answers 500 "Failed to promote draft" and logs the message. New CLI test in cli-create-preserves-existing-files.test.ts (32 tests, 25 fail on the sources of main).
- The five places where a task becomes a draft or a draft becomes a task now say why `filePath` is cleared: left set, the save would take over the source file and removing the source afterwards would delete the only copy.

Left alone, listed as known gaps in the pull request text
- The one-time draft prefix migration swallows a refused save and still marks itself done.
- Demoting through an edit has no compensating clean-up if removing the task file fails, unlike `task demote`.
- Archiving can replace a file of the same name in the archive folder.
- A task, draft or decision file whose name starts in upper case is not counted by the allocator.

Follow-up after publication: the draft prefix migration no longer hides a file it could not convert
- `migrateDraftPrefixes` in src/core/prefix-migration.ts records the prefixes only when every legacy `task-*.md` file in the drafts folder was converted. If a file is refused or fails, the files already converted stay converted, that file stays where it is, the config is left as it was so the migration runs again next time, and the error thrown names each such file with the reason (for a taken path, the write helper's message).
- If the legacy file cannot be removed after its draft was written, the new draft is removed again. Otherwise every later run would write another copy. Checked by hand on macOS with a locked file; there is no portable way to test it.
- How the message reaches the user: like every other migration failure, the error is thrown out of `ensureConfigMigrated`. The CLI runs that at start-up and ignores every error from it, so nothing is printed on the command line today. Printing it would be a change to that start-up block, not to the migration.
- New test in src/test/prefix-migration.test.ts: two legacy files, the draft path of one taken by a link with a missing target. It fails on main and on the previous branch tip.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Creating a task, draft, document or decision no longer deletes, replaces or overwrites an existing file, and never reuses a number that a local file name or a stored ID already carries, in any letter case.

What changed
- Allocation: `extractIdFromFilename` in src/utils/prefix-config.ts says which ID a file name claims, and `generateNextId` reads the number in any letter case. The task allocator always reads this project's own tasks and completed folders by name. The document and decision allocators count every local file name, including files that cannot be parsed. Draft allocation uses one method, `listOccupiedDraftIds`, for create, demote and the prefix migration.
- Saving: one private helper, `writeRecordFile` in src/file-system/operations.ts, writes the file for `saveTask`, `saveDraft`, `saveDocument` and `saveDecision`. It rewrites or moves only the file the record was loaded from and creates a new record's file only if the path is free. The four clean-ups that matched other files by name are removed.
- A stray file on the next number is skipped. Create, demote and promote refuse, with exit code 1, the file named and nothing changed, only when the new file's own path is already taken.
- The task create flow no longer backs up and restores a previous file, because a create can no longer replace one. The Git index rollback stays.
- `draft promote` reports a failure with its own message; "not found" now means only that there is no draft to promote.
- The one-time draft prefix migration records the prefixes only when every legacy file was converted. A file it could not convert stays where it is and is tried again on the next run.

Verification
- 32 CLI tests in src/test/cli-create-preserves-existing-files.test.ts, with projects outside the repository. 25 fail on the sources of main; the other 7 cover draft and task cases that main already handled. One new test in src/test/prefix-migration.test.ts covers the migration; it fails on main.
- The scoped test files, `bunx tsc --noEmit` and `bun run check .` pass. One test in config-commands.test.ts fails the same way on main.

Follow-ups
- Updates share the save step, so BACK-600 acceptance criteria 1 and 2 are covered here. Its doctor finding remains.
- A retitle checks the target and renames in two steps until updates take a lock (BACK-736).
- Task, draft and decision files whose names start in upper case are not counted by the allocator. That can give two files one number but cannot lose a file.
- The CLI ignores every migration error at start-up, so the message naming a legacy draft file that could not be converted is not printed on the command line.
- Demoting through an edit has no compensating clean-up if removing the task file fails. Archiving can replace a file of the same name in the archive folder. Both are unchanged.
- Not verified on Windows.
<!-- SECTION:FINAL_SUMMARY:END -->
