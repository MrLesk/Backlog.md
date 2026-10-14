---
id: BACK-765
title: >-
  Commit moved linked record files as links and report a failed commit in one
  sentence
status: To Do
assignee: []
created_date: '2026-10-14 04:13'
labels:
  - bug
dependencies:
  - BACK-731
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
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
- [ ] #1 With auto-commit on, `backlog task archive`, `backlog task restore` and `backlog task delete` of a task whose file is a symbolic link commit the link itself (added at its new path, removed from its old path), for a link whose target is inside the repository and one whose target is outside. Afterwards `git status` is clean.
- [ ] #2 An edit made through a committed link still commits the file the link points to, as before.
- [ ] #3 A record file inside a symbolic-linked folder that leads outside the repository is still moved, and the command says that the record was moved and that committing the change failed, and exits non-zero.
- [ ] #4 With auto-commit off, these commands stage nothing.
- [ ] #5 When the file was moved but the commit fails, `backlog task archive`, `backlog task restore` and `backlog task delete` print `Task <id> was archived (restored, deleted), but committing the change failed: <reason>` and exit non-zero. The MCP tools `task_archive`, `task_restore` and `task_delete` return the same sentence, and the web archive route answers with it and still reports the task as moved.
- [ ] #6 The rule for when a link is staged as the link and when its target is staged is written in one place in the code, including that the answer depends on the Git index and HEAD at the time of the call.
- [ ] #7 Tests drive the CLI and MCP for each behavior above with task files.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
