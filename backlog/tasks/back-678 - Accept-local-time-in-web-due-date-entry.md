---
id: BACK-678
title: Make due date a date-only string everywhere
status: To Do
assignee: []
created_date: '2026-09-02 18:26'
updated_date: '2026-09-02 19:47'
labels: []
dependencies: []
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A due date is a day, not an instant: a task due on the 5th is due on the 5th everywhere, so the value carries no time and no timezone meaning. Today it is modelled as a UTC datetime — the web input is type=datetime-local, the CLI documents --due-date as a UTC datetime, and BACK-677 (PR #992, merged) swept due dates into the local-time conversion built for created and updated timestamps. That conversion moves the day: a due date stored as 2026-09-05 00:00 renders as 2026-09-04 in America/Los_Angeles. Verified, and in main but not released.

Created and updated dates are the opposite case and are already right: they are genuine UTC timestamps, always with a time, displayed in the viewer's local timezone with the UTC value on hover. Leave them exactly as BACK-677 left them.

Make the due date a plain date string: stored as YYYY-MM-DD, entered as a day, displayed as written, with no conversion and no UTC hover on any surface. Existing records may hold a value with a time because the CLI accepted one, so reads must tolerate that and use its date part rather than failing or shifting it; writes store the date alone. Do not rewrite existing task files as a side effect.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Due dates are stored as a date-only string and no surface converts them by timezone or shows a UTC hover for them
- [ ] #2 Web due-date entry asks for a day, so the day picked is the day stored
- [ ] #3 CLI and MCP due-date entry take a date, and their help text no longer describes it as a UTC datetime
- [ ] #4 A stored value that still carries a time is read as its date part rather than failing, shifting, or being dropped, and existing files are not rewritten as a side effect
- [ ] #5 Created and updated timestamps keep the local rendering with UTC hover from BACK-677
- [ ] #6 Tests pin timezones whose offsets would shift a day (for example +14 and -8) and assert the due date is identical everywhere, including through an open-and-save cycle
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Maintainer decision (2026-09-02): the JSON envelope keeps schemaVersion 1 even though dueDate changes shape from an RFC 3339 instant to a date-only string. The JSON surface is young and dueDate is optional and rare, so bumping would spend a version break across every payload and field for one optional value, and any consumer checking schemaVersion === 1 would break everywhere at once rather than on the field that changed. A date-only string is also trivially parseable by anything that previously read an instant. The change belongs in the release notes, and a future bump to this surface absorbs it.
<!-- SECTION:NOTES:END -->
