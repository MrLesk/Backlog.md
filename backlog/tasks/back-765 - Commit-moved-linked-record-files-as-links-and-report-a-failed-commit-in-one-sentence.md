---
id: BACK-765
title: >-
  Commit moved linked record files as links and report a failed commit in one
  sentence
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-14 04:13'
updated_date: '2026-10-14 04:32'
labels:
  - bug
dependencies:
  - BACK-731
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - git-operations
  - core
  - mcp-server
modified_files:
  - src/git/operations.ts
  - src/core/backlog.ts
  - src/mcp/errors/mcp-errors.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/linked-record-commit.test.ts
  - src/test/commit-failure-after-change.test.ts
priority: high
type: bug
ordinal: 386000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With auto-commit on, moving a record file that is a symbolic link commits the wrong thing. On `main`, `backlog task archive` of a task whose file is a link commits only the removal of the old path and leaves the archived link untracked, with exit 0. On a fresh clone the task is gone and its ID can be handed out again. The cause is the Git helper that stages a path: it resolves the last part of the path through the link and stages the unchanged target. Restore and delete in the task archive stack behave the same way.

The same moves report a commit that fails after the file was moved in different words on each interface. `backlog task delete` says "Task X was deleted, but committing the change failed", `backlog task archive` prints only the Git error, and MCP `task_archive` answers "An unexpected error occurred". Every interface must say the same thing for the same case.

This was found while reviewing BACK-761, which archives documents and needs both fixes for linked document files. It is split out so the change to Git staging can be reviewed and reverted on its own.

Scope: the rule for which path is staged, and one message for "moved, but the commit failed" for archive, restore and delete. Demote and promote keep their current commit-failure message. A record file inside a linked folder whose target is outside the repository still cannot be committed; it must keep failing loudly.

This is part of the stack for issue #1101. It builds on BACK-720 (pull request #1097), and BACK-761 builds on it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With auto-commit on, `backlog task archive`, `backlog task restore` and `backlog task delete` of a task whose file is a symbolic link commit the link itself (added at its new path, removed from its old path), for a link whose target is inside the repository and one whose target is outside. Afterwards `git status` is clean.
- [x] #2 An edit made through a committed link still commits the file the link points to, as before.
- [x] #3 A record file inside a symbolic-linked folder that leads outside the repository is still moved, and the command says that the record was moved and that committing the change failed, and exits non-zero.
- [x] #4 With auto-commit off, these commands stage nothing.
- [x] #5 When the file was moved but the commit fails, `backlog task archive`, `backlog task restore` and `backlog task delete` print `Task <id> was archived (restored, deleted), but committing the change failed: <reason>` and exit non-zero. The MCP tools `task_archive`, `task_restore` and `task_delete` return the same sentence, and the web archive route answers with it and still reports the task as moved.
- [x] #6 The rule for when a link is staged as the link and when its target is staged is written in one place in the code, including that the answer depends on the Git index and HEAD at the time of the call.
- [x] #7 Tests drive the CLI and MCP for each behavior above with task files.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Stage a moved record file that is a link as the link: resolveExistingPath and changedFileLinkPath in src/git/operations.ts, with the folder helper named withResolvedFolder. The comment of changedFileLinkPath holds the whole rule, including that the answer depends on the Git index and HEAD at the time of the call; commitFiles marks the point before which every lookup of a path has to happen.
2. Replace commitFailedAfter with one error class, ChangeNotCommittedError, thrown by task archive, restore and delete. Task archive keeps the markRecordAlreadyMoved tag for the browser.
3. MCP: a shared runCoreOperation turns TaskRefusedError into VALIDATION_ERROR and ChangeNotCommittedError into OPERATION_FAILED, with core's message unchanged. The task handlers use it.
4. Tests with task files, through the CLI and MCP: archive, restore and delete of a task whose file is a link (target inside and outside the repository), an edit through a committed link, an archive folder linked outside the repository, auto-commit off, and the commit-failure sentence on the CLI, MCP and the web archive route.
5. Pull request body: the first edit through a link that is not committed yet commits only the link; demote and promote keep their own commit-failure message.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split out of BACK-761 after its second review. The Git helper rule, the one error class for a failed commit after a move, and the shared MCP mapping came over unchanged in behavior; the document cases stay in BACK-761.

Staging rule (src/git/operations.ts): resolveExistingPath resolves every folder on the way and the last component too, except a file link whose own path is new or changed in Git (git status). That link is staged under its own name. An unchanged link is resolved, so an edit through it still commits the file it points to. The comment of changedFileLinkPath says that the answer depends on the Git index and HEAD at the time of the call; commitFiles makes its last lookup (restoreIndexEntriesIfMatches) before update-ref, and a comment there marks it.

Before this change (built from 8901002e): archive of a task whose file is a committed link committed only the removal of the old path and left the archived link untracked, with exit 0; restore and delete after it committed nothing. The CLI printed only the Git error for a failed archive commit, and MCP task_archive, task_restore and task_delete answered An unexpected error occurred (INTERNAL_ERROR).

After: the commit holds the link at its new path and the removal of the old one; git status is clean. Task archive, restore and delete throw ChangeNotCommittedError; the CLI prints its message, MCP returns it as OPERATION_FAILED through runCoreOperation in src/mcp/errors/mcp-errors.ts, and the web archive route returns it with archiveState moved.

Known corner: a link that is new or re-pointed and not committed yet is the path that is staged, so the first edit through it commits only the link and the edit in its target waits for the next commit. The test file pins this. Staging both the link and its target would remove the corner; it needs commitFiles to read index entries under the paths it selected, so it is left as a follow-up.

Demote and promote keep their own commit-failure message (the Git error only); they are out of scope.

Checks: bunx tsc --noEmit and bun run check . pass. One file at a time: linked-record-commit 11 pass, commit-failure-after-change 8 pass, git 20, auto-commit 11, core-autocommit-scope 4, draft-lifecycle-autocommit-scope 6, task-autocommit-index-scope 3, symlink-backlog-root 3, cli-commit-behaviour 5, archived-task-folders 23, cli-task-delete 15, cli-task-restore 10, mcp-tasks 43, vacated-task-references 25, no failures. With the base Git helper the four link tests and the corner test fail; with the old archive error the four archive commit-failure tests fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
With auto-commit on, archive, restore and delete of a task whose file is a symbolic link now commit the link itself, at its new path and removed from its old one, for a target inside or outside the repository; before, archive committed only the removal and left the link untracked. The Git helper stages a file link under its own name when the link is new or changed in Git, and resolves it otherwise, so an edit through a committed link still commits the file it points to. The rule and its dependence on the Git index and HEAD are written in changedFileLinkPath in src/git/operations.ts.

A move whose commit fails is reported in one sentence: Task <id> was archived (restored, deleted), but committing the change failed: <reason>. Core throws ChangeNotCommittedError for it; the CLI prints it and exits 1, MCP returns it as OPERATION_FAILED through the shared runCoreOperation, and the web archive route returns it with the task reported as moved. Demote and promote keep their own message.

Tests drive the CLI and MCP with task files: link moves, an edit through a link, an archive folder linked outside the repository, auto-commit off, and the failure sentence. Known corner: the first edit through a link that is not committed yet commits only the link; the next edit commits the content. Follow-up candidate: stage both the link and its target.
<!-- SECTION:FINAL_SUMMARY:END -->
