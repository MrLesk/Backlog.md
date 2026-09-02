---
id: BACK-678
title: Accept local time in web due-date entry
status: To Do
assignee: []
created_date: '2026-09-02 18:26'
labels: []
dependencies: []
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-677 made the web display timestamps in the viewer's timezone with the stored UTC value on hover, but left the write path alone: due-date inputs are still labelled 'Due (UTC)' and still interpret what you type as UTC. So you type 14:30, the card then shows 16:30, and the hover explains why. Each half is correct and the pair is confusing, and it is the only place in the web where the user has to think in UTC.

Make entry match display: the field takes local time, the value is converted to UTC on save, and the label drops the UTC qualifier because the user is no longer being asked for UTC. Storage stays canonical UTC and the CLI, TUI and MCP keep taking UTC, exactly as they keep displaying it.

Two traps. Opening a task and saving it without touching the due date must store the same instant it had, not one shifted by the offset, so the local value shown in the field has to convert back to the same UTC value it came from. And a due date recorded without a time must stay date-only rather than acquiring one through a timezone conversion, matching the display rule BACK-677 established.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Due-date entry in the web interprets what the user types as local time and stores the corresponding UTC value
- [ ] #2 Opening a task and saving without editing the due date leaves the stored instant unchanged
- [ ] #3 A date-only due date stays date-only through an open-and-save cycle, with no time acquired from conversion
- [ ] #4 Entry labels no longer say UTC, since the field no longer asks for it
- [ ] #5 CLI, TUI and MCP due-date entry are unchanged and still take UTC
- [ ] #6 Tests cover the round trip in a non-UTC timezone, the date-only case, and that the stored value is UTC
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
