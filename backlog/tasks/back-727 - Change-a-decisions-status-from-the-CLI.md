---
id: BACK-727
title: Change a decision's status from the CLI
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1068'
type: enhancement
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decisions can be created and listed from the CLI, but their status cannot be changed afterwards. When a decision is replaced by a newer one, the old one keeps listing as accepted, so `backlog decision list` reports two contradictory decisions as both in force (issue #1068). The shipped guidance says never to edit decision files by hand, which leaves no supported way to retire a replaced decision. The issue also notes that the browser's decision save can set a status but rewrites the whole record, so it is not a safe way to change one field.

A decision's content stays immutable; only its status changes. The exact command name and flags are settled during plan review. Not part of this task: a superseded-by link between decisions, editing decision content, MCP decision tools, and web changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A documented `backlog decision` command, listed in `backlog decision --help` with its own help text, changes the status of an existing decision.
- [ ] #2 The command changes only the status in the decision's frontmatter; the rest of the file is byte-for-byte unchanged.
- [ ] #3 After the change, `backlog decision list --plain` shows the decision with its new status, so a replaced decision no longer lists as accepted.
- [ ] #4 Running the command for a decision that does not exist exits non-zero with a clear message and changes no file.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
