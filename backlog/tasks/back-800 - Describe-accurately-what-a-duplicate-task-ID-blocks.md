---
id: BACK-800
title: Describe accurately what a duplicate task ID blocks
status: To Do
assignee: []
created_date: '2026-11-10T07:23:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1146'
  - src/utils/duplicate-detection.ts
priority: low
type: bug
ordinal: 406000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When two task files claim one ID, the warning says: "Some task views may hide files and ID-based commands are blocked until the collision is repaired." Measured on main at e1a67143 with one duplicate pair and one clean task, that is the wrong way round. `backlog task list` and `backlog search` exit 1 with nothing on stdout. `backlog task view` and `backlog task edit` on the clean task succeed. Only a command that names the duplicated ID is refused, with its own ambiguity message. A person or script reading the warning looks for the problem in the wrong place (issue #1146). This task corrects the description only. Stopping list and search while a duplicate exists is existing, tested behavior and stays as it is; whether it should change is a separate product question.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With a duplicate task ID in the store, the warning says what actually happens: task list and search stop until the collision is repaired, a command that names the duplicated ID is refused as ambiguous, and commands that name any other ID keep working.
- [ ] #2 Every place that prints this warning shows the same corrected text from one shared source.
- [ ] #3 CLI help and shipped instructions that describe the duplicate-ID state agree with the corrected text.
- [ ] #4 Which commands succeed and which fail while a duplicate exists is unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
