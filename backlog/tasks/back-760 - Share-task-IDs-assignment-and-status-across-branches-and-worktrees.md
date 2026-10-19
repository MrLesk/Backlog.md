---
id: BACK-760
title: 'Share task IDs, assignment and status across branches and worktrees'
status: To Do
assignee: []
created_date: '2026-10-11 20:46'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/937'
  - 'https://github.com/MrLesk/Backlog.md/issues/1063'
priority: medium
type: feature
ordinal: 378000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog state travels only when branches travel. A task file changed in one branch or worktree is invisible everywhere else until that branch is merged, so people and agents working in parallel cannot see what the others are doing. Checked on version 1.53.0 with two worktrees of one repository: after one worktree sets a task to In Progress and assigns it, the other still shows it as To Do and unassigned, both before and after the change is committed, because the working copy of a task always wins over copies on other branches. A second agent can take the same task and neither is told. A task created in another worktree stays invisible until it is committed. Task IDs are kept apart only by listing every branch and every sibling worktree on each create.

Issues #937 and #1063 ask for this to be solved with claims: a claim holder identity, leases, expiry and heartbeats kept in a coordination area on the remote. Backlog.md will take a novel approach to the same problem. Assignment stays the only ownership concept, and the few facts that need one answer for everyone are recorded in a Git ref outside the branches, which every branch and worktree of a repository reads at once. This task covers one machine and needs no network. Sharing the same records through a remote is a later, separate and opt-in step.

Owner rulings of 2026-10-11 that bound the work:
- Markdown task files stay the source of truth and task bodies stay with their branch. The shared records hold selected task metadata only, never a task body.
- Only task IDs and assignment are arbitrated. Other metadata stays authoritative in each branch and is published so that others can see it. When published values disagree, the one changed most recently wins, and a later In Progress legitimately replaces an earlier Done.
- Lists show the latest published value first and mark a task whose file in the checkout says something different. Readiness is still judged from the checkout. This holds only if reads stay fast with thousands of tasks and hundreds of branches.
- No claim identity, lease, expiry, heartbeat, scheduler or separate database.
- Reads never use the network.

Facts checked with Git 2.54 on local repositories, which any design has to respect:
- A ref written in one worktree is readable in every other worktree of the repository immediately.
- `git update-ref` with an expected old value lets exactly one of 20 parallel writers win. A push with an expected old value does the same between clones, with one trap: two writers that push byte-identical objects are both told they succeeded, so every write needs something unique to its operation.
- A ref outside `refs/heads` is not copied by a plain clone, and a fetch through a wildcard refspec with `--prune` deletes the local copy when the remote lacks it. Backlog fetches with `--prune` today.
- Writing shared values into the task files of two branches at different times produces merge conflicts, also when the two branches changed different adjacent frontmatter lines. Synchronisation therefore never rewrites task files.
- With five writers sharing one assignee name, treating "already has the requested value" as success reported 40 winners for 8 tasks. A take succeeds only on an unassigned task.

Not yet decided, and settled during plan review: how the behaviour is switched on (the owner direction is two modes, offline for one machine and online with a remote, replacing `check_active_branches`, `active_branch_days` and the resolution strategy), exactly which metadata fields are shared, and what applies in projects without Git.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With two worktrees of one repository, an assignment made in one is refused in the other without any commit, merge or network access.
- [ ] #2 With two worktrees of one repository, a status change made by a Backlog command in one is shown by `backlog task list` in the other, marked as differing from the local task file.
- [ ] #3 Nothing in this work reads the network or scans branches on a read, and `backlog task list` stays within the budgets recorded by BACK-753 at 10,000 tasks and 500 branches.
- [ ] #4 Removing the shared records loses no task content, and no task file is rewritten by anything other than the command that changes that task.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
