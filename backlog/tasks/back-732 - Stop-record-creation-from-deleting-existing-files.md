---
id: BACK-732
title: Stop record creation from deleting existing files
status: To Do
assignee: []
created_date: '2026-10-11 19:07'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
priority: high
type: bug
ordinal: 350000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Creating a task, document or decision can delete an existing file of the same kind. The command prints success and exits 0, so nothing tells the user that a record is gone. Both cases below were reproduced on main at 380b8f83.

Copied file. A file named with the next free number that carries another record's ID in its frontmatter is removed by the next create. With `task-1 - First.md` in place and a hand-made copy `task-2 - Copied-task.md` that still contains `id: TASK-1`, `backlog task create` allocates number 2 and deletes the copy. `backlog doc create` and `backlog decision create` do the same to the equivalent document and decision files. Before the create, `backlog doctor --fix` had listed that task file under "Repair is blocked: filename and frontmatter ID do not identify the same task", so the create removed a file that was waiting for a person to decide what to do with it.

Letter case. A stored ID in a different letter case is not counted when the next number is chosen. A decision whose frontmatter says `id: DECISION-1` is overlooked, the next `backlog decision create` hands out number 1 again and deletes the first decision's file. A document with `id: DOC-1` is lost the same way through `backlog doc create`. Tasks are not affected: a task ID written in lower case is still counted.

Two things combine here: the save step removes files whose name starts with the ID being written, whatever their frontmatter says, and the step that picks the next number overlooks IDs it should have counted. Found while reviewing the document and decision write paths for issue #1065.

Relationship to BACK-600: that task covers the same filename-based cleanup when an existing document or decision is updated (`backlog doc update` deleting a file whose frontmatter names a different document, and a decision update leaving two files for one ID), and it adds a `backlog doctor` finding for a file name that disagrees with its frontmatter ID. This task covers creation for all three record kinds, including tasks, which BACK-600 does not mention, and the letter case of stored IDs. It adds no doctor finding and does not change update behavior. Both tasks touch the document and decision save step, so the one that lands second builds on the first.

Settled during plan review: whether, in the copied-file case, create moves on to a number that no file uses or refuses with an error that names the conflicting file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With a file named for the next free number that carries the ID of another record in its frontmatter (for example `task-2 - Copied-task.md` containing `id: TASK-1`), `backlog task create` leaves that file in place with its content unchanged.
- [ ] #2 `backlog doc create` and `backlog decision create` leave the equivalent document and decision files in place with their content unchanged.
- [ ] #3 With a decision whose frontmatter ID is written as `DECISION-1`, `backlog decision create` does not hand out number 1 again and the existing file is still present afterwards. The same holds for a document stored as `DOC-1` and `backlog doc create`.
- [ ] #4 After any `task create`, `doc create` or `decision create` that exits 0, every file that existed before the command is still present with unchanged content, and the ID the command reports belongs to a file that did not exist before.
- [ ] #5 If a create refuses to proceed because of a conflicting file, it exits non-zero, names that file and writes nothing.
- [ ] #6 Tests cover the copied-file case for tasks, documents and decisions and the upper-case ID case for documents and decisions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
