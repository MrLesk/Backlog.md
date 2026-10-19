---
id: BACK-744
title: Repair duplicate document and decision IDs with doctor --fix
status: To Do
assignee: []
created_date: '2026-10-11 19:10'
labels:
  - enhancement
dependencies:
  - BACK-735
  - BACK-600
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: enhancement
ordinal: 362000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two documents or two decisions can end up with the same ID. The usual way is that the same number is created in two clones and the branches are merged: the file names differ, so git merges cleanly and leaves two files sharing an ID. A hand-made copy has the same effect, and in the documents folder even a copy with an unrelated name such as `my-copy.md` counts as a document when its frontmatter carries a document ID.

Reproduced on main at 380b8f83: for tasks, `backlog doctor --fix --yes` renumbers one of the two files and the project is healthy again. For documents and decisions, `backlog doctor` lists the duplicate as "diagnostic only" and tells the user to give each file a unique id, `backlog doc view` and `backlog doc update` refuse the ID, and no command repairs it. The only way out is to edit a file by hand, which the shipped guidance tells users not to do.

The maintainer's ruling on issue #1065 is that `backlog doctor --fix` repairs duplicate document and decision IDs the way it repairs duplicate task IDs: a preview first, confirmation before anything is written, and anything it cannot decide safely is reported for a person to review, not guessed.

Depends on BACK-735 (the renumbered record gets its new ID from the shared allocator) and BACK-600 (writes identify a document or decision file by its frontmatter ID, and doctor reports a file name that disagrees with it).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doctor` shows a repair preview for duplicate document and decision IDs that names the file keeping the ID and the new ID each other file would get, and changes no file.
- [ ] #2 `backlog doctor --fix` asks for confirmation, and `--fix --yes` applies the previewed repair: each renumbered file gets a newly allocated ID in its frontmatter and file name, its content is otherwise unchanged, and no file is deleted.
- [ ] #3 After the repair `backlog doctor` reports no duplicate document or decision IDs, `backlog doc list` and `backlog decision list` show every record once, and each record can be viewed by its ID.
- [ ] #4 Which file keeps the ID follows a deterministic rule, so repeated previews of the same files show the same plan.
- [ ] #5 References to a renumbered document or decision that cannot be attributed to one of the files are listed for human review and are not rewritten, as for task repairs.
- [ ] #6 A duplicate the repair cannot handle safely is reported as blocked with the reason and left untouched. This includes a document file that is not named like a document, such as `my-copy.md`, unless the repair handles it; such a file is never ignored.
- [ ] #7 The duplicate document and decision findings no longer say "diagnostic only", and `backlog doctor --help` and the shipped instruction guides (`backlog instructions`) describe the repair for all three kinds.
- [ ] #8 The repair of duplicate task IDs behaves as before.
- [ ] #9 Tests cover the case of the same ID created in two clones and merged, for documents and for decisions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
