---
id: BACK-758
title: Make cross-branch loading cost independent of branch count
status: To Do
assignee: []
created_date: '2026-10-11 20:02'
updated_date: '2026-10-11 20:36'
labels: []
dependencies:
  - BACK-757
  - BACK-719
references:
  - src/core/task-loader.ts
  - src/core/backlog.ts
priority: medium
type: enhancement
ordinal: 376000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Loading task state from other branches costs git processes in proportion to the number of branches and files involved: each load runs two git commands per recently active branch tip and one more for every file version it reads. Measured on version 1.53.0 in a clone with 13 recent branches: 59 git processes for `backlog board export`, 62 for `backlog task create` and 644 for `backlog doctor`. Two causes stood out at that version. Versions that the working copy already overrides are still read from other branches, and loads that include finished tasks treat the finished tasks of the working copy as missing, so each of those files is read again from every branch that has it. BACK-719 replaces completed storage with a single archive and changes this loading, so the counts need measuring again on the code as it stands after that change before any work starts. For scale, a prototype on this repository with 255 branch refs: listing the backlog folder of every ref one at a time took 2.9 s, a single `git log` for commits outside the current history that touch the backlog folder took 0.04 s, and reading 1,000 file versions through one `git cat-file --batch` took 0.2 s. These loads serve the board, the web UI, `doctor`, `overview` and task ID allocation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The number of git processes started by one cross-branch load does not grow with the number of branches or with the number of task files read, shown by a test that compares a small and a large fixture.
- [ ] #2 A task version is read from another branch only when the result depends on it. In particular, a finished task that is present in the working copy is not read again from other branches.
- [ ] #3 The board, the web task list, `doctor`, `overview` and task ID allocation return the same tasks, statuses and occupied IDs as before across the existing cross-branch tests, including tasks that exist only on another branch, tasks archived on another branch, renamed task files and branches merged by squash.
- [ ] #4 `check_active_branches`, `remote_operations`, `active_branch_days` and `filesystem_only` keep their documented effect.
- [ ] #5 A backlog folder reached through a symlink still loads.
- [ ] #6 Before and after git process counts and timings for `backlog board export` and `backlog doctor` are recorded in the task.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
