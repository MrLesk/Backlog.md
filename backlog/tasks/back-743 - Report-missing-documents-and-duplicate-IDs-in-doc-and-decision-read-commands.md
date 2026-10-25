---
id: BACK-743
title: Report missing documents and duplicate IDs in doc and decision read commands
status: To Do
assignee: []
created_date: '2026-10-11 19:10'
updated_date: '2026-10-25T19:16:00Z'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: bug
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document and decision read commands show two problems on screen but not in their exit code, or do not show them at all, so scripts and other callers take a failure for success. Reproduced on main at 380b8f83:

- `backlog doc view <id>` for an ID that matches no document prints "Document <id> not found." and exits 0. `backlog task view` exits 1 in the same case.
- When two files share an ID, `backlog doc list` and `backlog decision list` print both rows with no warning and exit 0. This happens when the same number is created in two clones and the branches are merged. `backlog task list` prints a warning that names the duplicated ID and exits 1. The document and decision lists therefore look healthy while `backlog doc view` and `backlog doc update` already refuse the duplicated ID and `backlog doctor` reports it.

The maintainer's ruling on issue #1065 is that document and decision commands follow the task commands where a defect like this exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog doc view <id>` for an ID that matches no document prints a not found message to stderr and exits non-zero.
- [ ] #2 `backlog doc list` prints a warning when two or more document files share an ID, naming the ID and the files and pointing to `backlog doctor`, and exits non-zero, as `backlog task list` does for duplicate task IDs.
- [ ] #3 `backlog decision list` does the same for decisions; with `--json` the warning goes to stderr and stdout stays valid JSON.
- [ ] #4 Without duplicates both list commands print no warning and exit 0, and their output is unchanged.
- [ ] #5 Tests cover the missing document and a duplicated ID for documents and for decisions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The missing-document exit-code criterion is implemented and verified by BACK-743.1 for issue #1148. Both real CLI output modes now exit 1 with the not-found message on stderr and empty stdout. Remaining document/decision list diagnostics stay in this parent task.
<!-- SECTION:NOTES:END -->
