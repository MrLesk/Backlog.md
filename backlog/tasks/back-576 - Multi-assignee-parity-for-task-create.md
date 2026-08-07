---
id: BACK-576
title: Multi-assignee parity for task create
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/848'
priority: medium
type: bug
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #848. `backlog task create -a "@a,@b"` stores one literal assignee "@a,@b" because create wraps the raw option value (`[String(options.assignee)]` at src/cli.ts:1821, with the same pattern on the draft path at src/cli.ts:3452), while `task edit` parses the same input through parseDelimitedStringList (src/cli.ts:2999). Repeated `-a` flags silently keep only the last value because the option is declared non-collecting (src/cli.ts:1707, src/cli.ts:2689, src/cli.ts:3440).

The result is that the documented multi-assignee capability works on edit but not on create, and both failure modes are silent. The same defect class was already fixed for --labels in issue #692 / PR #693, so create should reach parity with edit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Comma-separated assignees parse into separate assignees on `task create`
- [ ] #2 Comma-separated assignees parse into separate assignees on the draft creation path
- [ ] #3 Repeated -a flags collect into multiple assignees on `task create`
- [ ] #4 Repeated -a flags collect into multiple assignees on `task edit`
- [ ] #5 Tests cover comma-separated and repeated-flag input on both create and edit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
