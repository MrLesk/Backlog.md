---
id: BACK-760.3
title: Show task changes from other branches and worktrees in lists
status: To Do
assignee: []
created_date: '2026-10-11 20:46'
labels: []
dependencies:
  - BACK-760.2
  - BACK-753
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/937'
  - 'https://github.com/MrLesk/Backlog.md/issues/1063'
parent_task_id: BACK-760
priority: medium
type: feature
ordinal: 381000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A status, priority or label changed in another branch or worktree is invisible until that branch is merged, and a task created elsewhere is invisible until it is committed. The board and the web UI already read other branches, but for a task that also exists in the checkout the local copy always wins, so a change made elsewhere to an existing task is never shown. This subtask publishes the metadata that a Backlog command changes to the shared records and shows it in lists. Owner rulings of 2026-10-11: among published values the one changed most recently wins, and a later In Progress legitimately replaces an earlier Done; lists show that value first and mark a task whose local file differs; readiness is judged from the checkout; publishing never rejects an edit. Showing the latest value first holds only if reads stay fast with thousands of tasks and hundreds of branches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A metadata change made by a Backlog command in one worktree (status, title, priority, labels, milestone, dependencies or parent) is shown by `backlog task list` and `backlog task view` in every other worktree and branch of the repository on the next command, without a commit.
- [ ] #2 When the value shown differs from the task file in the checkout, the row is marked, and the task view names the branch the value came from and when it was changed.
- [ ] #3 A task created in another worktree appears in lists before it is committed, marked as not present in this checkout.
- [ ] #4 Published changes are ordered by when they were made, not by when they were recorded: a change made earlier but recorded later does not replace a newer one, and two changes made in the same second resolve the same way in every checkout.
- [ ] #5 A change that replaces a value its author had not seen is still applied, and the command that made it says so.
- [ ] #6 `isReady` and the readiness explanation use the task files of the checkout. When the shown status of a dependency is ahead of the checkout, the explanation says that the dependency is Done in shared state but not marked complete in this checkout.
- [ ] #7 Only the fields a command changed are published, and reading a hand-edited task file publishes nothing.
- [ ] #8 JSON output tells the shown value and the local file value apart without changing the meaning of any existing version 1 field.
- [ ] #9 The board, the TUI and the browser show the same values and marks as the CLI.
- [ ] #10 `backlog task list --plain` stays within the budgets recorded by BACK-753 at 10,000 tasks and 500 branches, and no read uses the network or scans branches.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
