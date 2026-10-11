---
id: BACK-730
title: Add task delete for archived tasks
status: To Do
assignee: []
created_date: '2026-10-11 13:02'
labels:
  - enhancement
dependencies:
  - BACK-719
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1064'
priority: high
type: enhancement
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md has no proper way to delete a task. Archive used to act as a soft delete: it released the task ID, and a task that was brought back got a new one. BACK-719 changes archive so that it keeps the ID, which leaves no way to remove a task for good or to free its ID (maintainer direction on issue #1064).

Delete is the explicit second step that releases an ID, and it only works on a task that is already archived. Archiving is the confirmation step, which is why delete itself has no prompt and no confirmation flag.

The CLI is the canonical surface for delete, and the MCP server offers the same operation. The TUI and browser do not get a delete control in this task.

Depends on BACK-719: delete acts on the archive that task leaves in place, where every archived task keeps its ID.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog task delete <id>` on an archived task exits zero and permanently removes that task from the project, so `backlog task view <id>` no longer finds it.
- [ ] #2 `backlog task delete <id>` on a task that is not archived exits non-zero with an error saying the task must be archived first, and leaves the task unchanged.
- [ ] #3 `backlog task delete <id>` runs without a prompt and offers no confirmation flag.
- [ ] #4 Deleting an archived task releases its ID, so the ID is no longer reserved and can be assigned to a newly created task.
- [ ] #5 Delete removes incoming dependencies and references to the deleted task from other tasks, and its output names the tasks that were changed.
- [ ] #6 Delete is refused while subtask records of the task still exist: it exits non-zero with an error that says so, and leaves the task and its subtasks unchanged.
- [ ] #7 The MCP server offers the same delete operation with the same rules as the CLI.
- [ ] #8 Command help and the shipped instruction guides (`backlog instructions`) describe the two-step archive-then-delete deletion.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
