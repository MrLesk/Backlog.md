---
id: BACK-760.2
title: Make assignment exclusive across branches and worktrees
status: To Do
assignee: []
created_date: '2026-10-11 20:46'
labels: []
dependencies:
  - BACK-760.1
  - BACK-759
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/937'
  - 'https://github.com/MrLesk/Backlog.md/issues/1063'
parent_task_id: BACK-760
priority: medium
type: feature
ordinal: 380000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-759 makes `-a` fail on a task that already has an assignee, but it reads the assignee from the task file in the checkout. An assignment made in another branch or worktree is not in that file, so a second agent working elsewhere on the same machine still takes the task and gets no error. Checked on version 1.53.0: after one worktree assigned a task and set it In Progress, a second worktree showed it as unassigned and To Do, before and after the first one committed. This subtask makes the current holder a shared fact that is recorded when a task is taken and seen at once by every branch and worktree of the repository. The same name does not mean the same entity, so the holder is never inferred from a matching name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After `backlog task edit <id> -a @name` succeeds in one worktree, the same command in any other worktree or branch of that repository fails with the BACK-759 message naming the holder, with nothing committed and no network access.
- [ ] #2 When several commands try to take the same unassigned task at the same moment, exactly one succeeds, also when all of them use the same assignee name. Shown by a test with parallel takes.
- [ ] #3 `--reassign` changes the shared holder, and a later `-a` from anywhere in the repository sees the new holder.
- [ ] #4 `backlog task view` and `backlog task list` show the shared holder and mark a task whose file in the checkout names someone else or nobody.
- [ ] #5 A hand edit of the assignee line in a task file neither takes nor releases the task. The difference is shown, and the shared holder changes only through a Backlog command.
- [ ] #6 The MCP `task_edit` tool gets the same refusal, and the TUI and the browser show the shared holder.
- [ ] #7 Projects without Git keep the BACK-759 behaviour unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
