---
id: BACK-760.1
title: Reserve task IDs in records shared by every branch and worktree
status: To Do
assignee: []
created_date: '2026-10-11 20:46'
labels: []
dependencies:
  - BACK-754
  - BACK-719
  - BACK-730
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/937'
  - 'https://github.com/MrLesk/Backlog.md/issues/1063'
parent_task_id: BACK-760
priority: medium
type: feature
ordinal: 379000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Creating a task finds the next free ID by listing task files on every recent branch and in every sibling worktree. On version 1.53.0 one `backlog task create` started 62 git processes in a clone with 13 recent branches, and the count grows with branches and worktrees, all while the create lock is held. This subtask introduces the shared records described in the parent task and makes them the place where task IDs are reserved on one machine. The ID lifecycle is the one BACK-719 and BACK-730 define: a task on the board or in the archive keeps its ID reserved, and deleting an archived task or demoting a task releases it. Related: BACK-735 moves document and decision IDs onto the task allocator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two worktrees of one repository that create tasks at the same moment, including tasks that are never committed, never receive the same ID, shown by a test with parallel creates.
- [ ] #2 `backlog task create` no longer lists the task folders of other worktrees or other local branches to find a free ID, and the number of git processes it starts does not grow with the number of branches or worktrees.
- [ ] #3 With `remote_operations` enabled, IDs in use on remote branches are still avoided exactly as before.
- [ ] #4 IDs of tasks on the board and in the archive stay reserved, and `backlog task delete` and demotion release the ID, as BACK-719 and BACK-730 define.
- [ ] #5 A task file that has no record (created by an older version, written by hand, or arriving through a merge) keeps its ID reserved and is listed by `backlog doctor`.
- [ ] #6 If the shared records are missing or unreadable, no ID is handed out twice: Backlog either rebuilds them from the task files or refuses to create until they are rebuilt, and says which.
- [ ] #7 Projects without Git allocate IDs as before.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
