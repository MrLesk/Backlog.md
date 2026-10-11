---
id: BACK-729
title: Show the acceptance-criteria ring on web cards in every status
status: To Do
assignee: []
created_date: '2026-10-11 10:43'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1072'
type: enhancement
ordinal: 347000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web board cards show the acceptance-criteria ring only while a task is In Progress. Projects with custom statuses, for example an Awaiting test column where a reviewer ticks criteria one by one, never see progress on those cards, even at 4 of 6 checked (issue #1072, 1.53.0).

The issue proposes showing the ring in every status except the final one, or making the set of statuses configurable. The maintainer's direction is simpler: show the ring in any status. A config option is not part of this task. This task covers web board cards only; whether the TUI progress indicator follows the same rule is not decided here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A web board card shows the acceptance-criteria ring whenever its task has at least one acceptance criterion, in every status: the first status, the final status, and any custom status.
- [ ] #2 A card for a task with no acceptance criteria shows no ring.
- [ ] #3 The ring on In Progress cards looks and counts as it does today.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
