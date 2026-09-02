---
id: BACK-678
title: 'Treat due dates as calendar days, not instants'
status: To Do
assignee: []
created_date: '2026-09-02 18:26'
updated_date: '2026-09-02 18:40'
labels: []
dependencies: []
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A due date is a day, not a timestamp: a task due on the 5th is due on the 5th in every timezone. BACK-677 (PR #992) treated it as an instant and routed it through the local-time conversion built for created and updated timestamps, so a due date can now render as a different calendar day for a viewer whose offset crosses midnight, and the entry field still asks for a UTC datetime. That conversion is wrong and shipped today.

Stop converting due dates for display: render the stored calendar day as-is, with no timezone shift and no UTC hover, the same treatment date-only values already get. Created and updated timestamps are genuine instants and keep the local rendering BACK-677 added.

Entry should follow the same idea rather than asking for a UTC datetime, so the value a user picks is the day they mean. Storage stays canonical, CLI and MCP behavior is a separate question that is not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A due date renders as its stored calendar day in the web, unchanged by the viewer timezone and with no UTC hover
- [ ] #2 Due-date entry in the web asks for a day rather than a UTC datetime, and the day a user picks is the day that is stored
- [ ] #3 A due date that already carries a time in storage still renders as its calendar day rather than shifting or being dropped
- [ ] #4 Created and updated timestamps keep the local rendering with UTC hover introduced by BACK-677
- [ ] #5 Tests pin a timezone whose offset would shift the day and assert the due date does not move, including through an open-and-save cycle
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
