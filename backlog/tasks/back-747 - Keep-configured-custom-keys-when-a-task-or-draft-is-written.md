---
id: BACK-747
title: Keep configured custom keys when a task or draft is written
status: To Do
assignee: []
created_date: '2026-10-11 19:34'
labels:
  - enhancement
dependencies:
  - BACK-733
  - BACK-746
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
type: enhancement
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Editing a task drops every top-level frontmatter key Backlog does not know. Reproduced on main at 507d94d5 with the steps from issue #918: a task file is given an `approval:` block of four lines, `backlog task edit TASK-1 -s "In Progress"` exits 0, the status and `updated_date` are written, and the whole `approval` block is gone. Nothing reports the loss. The reporter extends task files with keys for another tool, and a commenter runs automations on recurrence and reminder keys, so every such extension is one edit away from losing its data.

The maintainer's ruling on issues #918 and #1091 is that Backlog does not keep unknown keys implicitly; it keeps the keys a project lists in its config. Tasks and drafts share one list (working name `task_custom_fields`, added by BACK-746; the exact key name is settled during plan review). A key named there survives every write of a task or draft. A key that is not in the list keeps being dropped as today.

A kept key is written back exactly as the user wrote it: Backlog keeps the key's own frontmatter lines and does not write a parsed value back. Writing parsed values back was shown to change `2026-02-01` into a full timestamp, `1.10` into `1.1` and `007` into `7`.

This first version only keeps the keys. They are written by the project's own tools, as both reporters do. Setting or clearing them through the CLI, MCP or web UI is not part of it, and showing them on read surfaces is covered by separate tasks. Removing a name from the list needs no migration: files keep the key until their next write and lose it then.

Not yet examined and settled during plan review: a quoted key name, a key that appears twice in one file, a YAML anchor defined inside a key that is dropped, and files with CRLF line endings.

Depends on BACK-733 (the frontmatter writer no longer reads the body again, which this builds on) and BACK-746 (the config list and its reserved names).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With `task_custom_fields: [approval]` set (working name), the reproduction from issue #918 keeps the key: after `backlog task edit TASK-1 -s "In Progress"` the four `approval` lines are in the file byte for byte as they were, the status is updated and `updated_date` is set.
- [ ] #2 Values are never rewritten: a configured key written as `reviewed: 2026-02-01`, `ratio: 1.10`, `code: 007`, a flow list such as `[a, b]`, or a nested block that contains a comment has exactly the same lines after any write.
- [ ] #3 The kept lines follow the keys Backlog writes, in the order of the config list; the rest of the frontmatter and the body are written as today.
- [ ] #4 A configured key survives every write of a task or draft from the CLI, web UI, MCP and TUI, including status changes, archive and complete, board reordering, and promoting a draft to a task or demoting a task to a draft.
- [ ] #5 A key that is in the file but not in the list is still dropped on the next write, and without the list set the issue #918 reproduction behaves as it does today.
- [ ] #6 A name reserved for tasks, such as `status`, in the list is rejected with the existing config error, and no task or draft file is changed.
- [ ] #7 Removing a name from the list makes it an unconfigured key again: no file is rewritten because of the config change, and each file that carries the key loses it on its next write.
- [ ] #8 The document and decision lists have no effect on task and draft files.
- [ ] #9 A task edit that changes nothing still writes nothing, and files that carry no configured key are written byte for byte as today.
- [ ] #10 The configuration reference states that the list keeps these keys for tasks and drafts and that values are kept as written.
- [ ] #11 Tests cover the issue #918 reproduction with and without the list, the value shapes named above, promote and demote, and removing a name from the list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
