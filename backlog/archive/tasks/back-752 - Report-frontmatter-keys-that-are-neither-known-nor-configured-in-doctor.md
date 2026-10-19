---
id: BACK-752
title: Report frontmatter keys that are neither known nor configured in doctor
status: To Do
assignee: []
created_date: '2026-10-11 19:36'
updated_date: '2026-10-18 19:45'
labels:
  - enhancement
dependencies:
  - BACK-746
  - BACK-747
  - BACK-748
  - BACK-749
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/918'
  - 'https://github.com/MrLesk/Backlog.md/issues/1091'
type: enhancement
ordinal: 370000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A frontmatter key that is neither known to Backlog nor named in the custom field lists of the project is dropped the next time its record is written, and nothing warns about it beforehand. Reproduced on main at 507d94d5: with an `approval` block in a task file and `depends_on` in a document file, `backlog doctor` prints "No duplicate IDs, self-referential dependencies, or dependency cycles found." and exits 0, and the next `backlog task edit` or `backlog doc update` removes the keys (issues #918 and #1091). A user learns that a key has to be listed only after its data is gone, and after removing a name from a list has no way to see which files still carry it.

The maintainer's ruling on both issues is that keys outside the lists keep being dropped, and that `backlog doctor` is where they become visible: it reports the files and the keys, together with the config line that would keep them. The finding is advice about the project config, not a defect in the records, so on its own it does not make `backlog doctor` exit non-zero.

The custom field lists are per record type: tasks and drafts share one, documents have their own, and decisions have their own (working names `task_custom_fields`, `document_custom_fields`, `decision_custom_fields`, added by BACK-746). The finding follows that split, so a key is checked against the known keys and the list of its own record type.

Depends on BACK-746 (the lists and the reserved names) and on BACK-747, BACK-748 and BACK-749, so that the config line doctor prints really keeps the keys for every record type it reports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog doctor` lists each task, draft, document and decision file it reads that carries a top-level frontmatter key which is neither a known key for that record type nor in the custom field list of that type, naming the file and the keys.
- [ ] #2 For each record type with such keys it prints the config line that would keep them, for example `task_custom_fields: [approval]`, including the names already in that list.
- [ ] #3 A key whose name the config rule does not allow is still reported and is left out of the printed config line.
- [ ] #4 When this is the only kind of finding, `backlog doctor` exits 0; together with other findings the exit code is the one those findings give today.
- [ ] #5 A key that is in the list for its record type is not reported, and after a name is removed from a list the files that still carry it are reported again.
- [ ] #6 The finding is report only: the scan rewrites no file, and `backlog doctor --fix` changes no file because of it.
- [ ] #7 With an `approval` block in a task file and `depends_on` in a document file and no lists set, `backlog doctor` names both files and both keys before any write removes them.
- [ ] #8 A project in which no file carries such a key gets the same `backlog doctor` output and exit code as today.
- [ ] #9 `backlog doctor --help` and the shipped instruction guides (`backlog instructions`) mention the finding.
- [ ] #10 Tests cover the finding for each record type, the printed config line, the exit code alone and together with another finding, and a configured key not being reported.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18: Canceled: Alex's 2026-10-18 decision preserves all unknown keys automatically. No configuration lists or unconfigured-key doctor warning are planned. BACK-748 implements document/decision preservation, and BACK-747 retains future task/draft scope. This task is archived unimplemented, not Done.
<!-- SECTION:NOTES:END -->
