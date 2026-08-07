---
id: BACK-584
title: Keep vim keys inside the list at navigation boundaries
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/768'
  - 'https://github.com/MrLesk/Backlog.md/issues/770'
priority: medium
type: enhancement
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issues #768 and #770. Today j/k at the top or bottom of the task list, the detail pane, and the board (including empty columns) hands focus to the search input. That handoff was deliberate (BACK-399), but it surprises vim users, who expect j/k to stop at a boundary rather than leave the list. PR #770 proposed a `wrapNavigationToSearch` config key.

Maintainer decision (confirmed): no new config key. Instead, j and k never enter the search input at boundaries, while the arrow keys keep the existing boundary handoff into search. `/` and Ctrl+F continue to focus the search input directly. This preserves the discoverability BACK-399 was after for arrow-key users while giving vim users the behavior they expect, without adding configuration surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 j at the last row keeps focus in place in the task list, the detail pane, and the board (including empty columns)
- [ ] #2 k at the first row keeps focus in place on the same three surfaces
- [ ] #3 ArrowDown at the last row and ArrowUp at the first row still hand focus off to the search input
- [ ] #4 `/` and Ctrl+F still focus the search input directly
- [ ] #5 No new configuration key is introduced
- [ ] #6 Existing navigation tests are updated to the new j/k behavior
- [ ] #7 Help text and docs that describe the old j/k boundary behavior are updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
