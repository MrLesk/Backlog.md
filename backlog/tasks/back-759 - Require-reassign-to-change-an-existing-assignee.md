---
id: BACK-759
title: Require --reassign to change an existing assignee
status: To Do
assignee: []
created_date: '2026-10-11 20:40'
labels: []
dependencies:
  - BACK-719
references:
  - src/cli.ts
  - src/core/backlog.ts
  - src/mcp/utils/schema-generators.ts
  - src/guidelines/cli-instructions/task-execution.md
priority: high
type: enhancement
ordinal: 377000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task edit <id> -a @name` replaces the assignee list without looking at what is already there. Agents take work with exactly this command, because the shipped task-execution guide tells them to mark a task in progress and assign themselves. When two agents pick the same task, the second one silently replaces the first and both carry on, so the same work is done twice and nobody is told. Comparing names cannot prevent this: agents usually sign with the generic name of their tool (in this repository 266 tasks are assigned to `@codex` and 122 to `@claude`), so two sessions of the same tool look identical. Owner ruling of 2026-10-11: `-a` fails on a task that already has an assignee, including when the name is the same, because the same name does not mean the same entity, and the error proposes `--reassign` as the explicit way to take a task over or hand it on. This is a deliberate breaking change to the documented behaviour of `-a` on edit, which today replaces all assignees. The current assignee is the one in the task file of the checkout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog task edit <id> -a @name` on a task with no assignee assigns it as today, and `backlog task create -a` is unchanged.
- [ ] #2 The same edit on a task that already has an assignee, including one with the same name, exits non-zero, applies none of the other changes in that command, and prints a message that names the current assignee and gives the exact `--reassign` command that would take the task over.
- [ ] #3 `backlog task edit <id> --reassign @name` replaces the assignees whatever the current value. It accepts several names the way `-a` does, and `--reassign ""` clears them.
- [ ] #4 `-a ""` on a task that has an assignee fails in the same way, and a command that passes both `-a` and `--reassign` is rejected.
- [ ] #5 `backlog draft edit` behaves the same way as `backlog task edit` for `-a` and `--reassign`.
- [ ] #6 The MCP `task_edit` tool follows the same rule and offers an equivalent reassign input, and its tool description says so.
- [ ] #7 Where a person edits the assignee field directly (the interactive edit wizard, the TUI and the browser), changing it is an explicit reassignment and keeps working without an extra step.
- [ ] #8 Command help, shell completion and the shipped instruction guides, `backlog instructions task-execution` in particular, explain taking a task with `-a`, what the error means, and when `--reassign` is appropriate.
- [ ] #9 Tests cover an unassigned task, a different name, the same name, clearing, reassigning, a combined command that is rejected with nothing applied, and the MCP tool.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
