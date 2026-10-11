---
id: BACK-719
title: Replace task completion with one archive flow and add task delete
status: To Do
assignee: []
created_date: '2026-10-11 10:42'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
priority: high
type: bug
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md has two ways to take a task off the board, and their names hide what they do. Complete moves a task in the final status to completed storage and keeps its ID, but a completed task can no longer be edited and no command restores it to the board (issue #1064, reproduced on 1.53.0). Archive behaves like a soft delete: it releases the task ID, and a task that is brought back gets a new one. Human and automated users confuse the two because of their names, and there is no proper way to delete a task.

The maintainer's direction on the issue is a deliberate breaking change. Completion is removed in favor of a single archive flow that applies to every task, including tasks in the final status, and deleting a task becomes a separate second step that only works after archiving. This reverses the rule from BACK-691, under which archiving a task in the final status is rejected with guidance to use Complete.

The CLI is the canonical surface for this lifecycle; the TUI, browser, and MCP follow the same rule.

Not yet decided, and settled during plan review: what happens to tasks already in completed storage, whether and how an archived task is restored or edited, what archive does to incoming dependencies and references, and what `backlog cleanup` becomes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog task complete` is no longer an available operation: it is absent from `backlog task --help`, and running it exits non-zero without changing any task.
- [ ] #2 `backlog task archive <id>` succeeds for a task in any status, including the configured final status.
- [ ] #3 Archiving preserves the task ID: the archived task keeps its ID, and a task created afterwards is not assigned that ID.
- [ ] #4 `backlog task delete <id>` on an archived task exits zero and removes that task from the project.
- [ ] #5 `backlog task delete <id>` on a task that is not archived exits non-zero with an error saying the task must be archived first, and leaves the task unchanged.
- [ ] #6 Deleting an archived task releases its ID, so the ID is no longer reserved and can be assigned to a newly created task.
- [ ] #7 The TUI, browser, and MCP follow the same rule as the CLI: no separate complete action remains, archive applies to a task in any status and preserves its ID, and wherever delete is offered it is refused for a task that is not archived.
- [ ] #8 Command help and the shipped instruction guides (`backlog instructions`) describe the single archive flow and the two-step archive-then-delete deletion, and no longer direct users to a complete command.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
