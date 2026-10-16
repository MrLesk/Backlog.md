---
id: BACK-748
title: Keep configured custom keys when a document is written
status: To Do
assignee: []
created_date: '2026-10-11 19:35'
labels:
  - enhancement
dependencies:
  - BACK-733
  - BACK-746
  - BACK-747
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
type: enhancement
ordinal: 366000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Updating a document drops every top-level frontmatter key Backlog does not know. Reproduced on main at 507d94d5 with the steps from issue #1091: a document file is given `depends_on: [example]` and `task: TASK-1`, `backlog doc update doc-1 --content "x"` exits 0, and both lines are gone. `doc update` rewrites the file on every call, so any update loses them, whatever it was meant to change. The reporter keeps this metadata in frontmatter for a checker that reads it.

The maintainer's ruling on issues #918 and #1091 is that Backlog does not keep unknown keys implicitly; it keeps the keys a project lists in its config. Documents have their own list (working name `document_custom_fields`, added by BACK-746; the exact key name is settled during plan review). A key named there survives every write of a document. A key that is not in the list keeps being dropped as today.

A kept key is written back exactly as the user wrote it: Backlog keeps the key's own frontmatter lines and does not write a parsed value back, by the same rule BACK-747 introduces for tasks and drafts. Documents reuse that rule; they do not get a second implementation.

This first version only keeps the keys. Setting or clearing them through the CLI, MCP or web UI is not part of it. `backlog doc view --plain` prints the file as stored, so a kept key is already visible there; the other read surfaces are covered by separate tasks. Removing a name from the list needs no migration: files keep the key until their next write and lose it then.

Depends on BACK-733 (the frontmatter writer no longer reads the body again), BACK-746 (the config list and its reserved names) and BACK-747 (the shared rule for keeping the lines of a key). The command is `backlog doc edit` once BACK-741 has landed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With `document_custom_fields: [depends_on, task]` set (working name), the reproduction from issue #1091 keeps the keys: after `backlog doc update doc-1 --content "x"` the lines `depends_on: [example]` and `task: TASK-1` are in the file byte for byte as they were, and the content is updated.
- [ ] #2 Values are never rewritten: a configured key written as a bare date, a number such as `1.10` or `007`, a flow list or a nested block has exactly the same lines after any write.
- [ ] #3 The kept lines follow the keys Backlog writes, in the order of the config list; the rest of the frontmatter and the body are written as today.
- [ ] #4 A configured key survives every write of a document: content, title, type, tag and path changes from the CLI, saves from the web UI and the MCP `document_update` tool.
- [ ] #5 A key that is in the file but not in the list is still dropped on the next write, and without the list set the issue #1091 reproduction behaves as it does today.
- [ ] #6 A name reserved for documents, such as `tags`, in the list is rejected with the existing config error, and no document file is changed.
- [ ] #7 Removing a name from the list makes it an unconfigured key again: no file is rewritten because of the config change, and each file that carries the key loses it on its next write.
- [ ] #8 The task and decision lists have no effect on document files.
- [ ] #9 The configuration reference states that the list keeps these keys for documents.
- [ ] #10 Tests cover the issue #1091 reproduction with and without the list, the value shapes named above, and removing a name from the list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
