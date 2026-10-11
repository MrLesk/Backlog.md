---
id: BACK-726
title: Show the last modified date on web board cards
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1067'
type: enhancement
ordinal: 344000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web board cards show when a task was created but not when it was last modified, so scanning the board does not reveal which tasks are being worked on and which have gone quiet without opening each one (issue #1067).

Tasks already record an updated date, and the board's task list response already carries it, so this is a display change. The task list response should not grow to expose more task fields, and this task adds no field to any API response. A config setting to turn the date on or off is requested in the issue and is not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each web board card shows the task's last modified date next to the created date, in the same relative style, and distinguishable from the created date.
- [ ] #2 A card for a task with no updated date shows nothing for last modified.
- [ ] #3 No field is added to any API response; the card uses the updated date that the board's task list response already provides.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
