---
id: BACK-677
title: Show local time in the web UI with the UTC value on hover
status: To Do
assignee: []
created_date: '2026-09-02 17:01'
labels: []
dependencies: []
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported in https://github.com/MrLesk/Backlog.md/issues/991: the browser shows task timestamps in UTC, so a user in any other timezone reads a time that is not theirs. Timestamps are stored canonically in UTC and every surface renders them that way, which is the BACK-421 decision, but the CLI, TUI and plain output all pass appendUtcLabel so the reader sees '(UTC)' and knows what they are looking at. The browser calls the same helper without the label, so the value looks local and is not.

The browser is the one surface that knows the viewer's timezone and can show more on hover, so it should be the friendly one: render the local time as the visible value and put the canonical UTC value in the title attribute, so hovering shows something like '2026-08-30 19:38 (UTC)'. The CLI, TUI and plain output stay in UTC and are not part of this change.

One correctness trap: many stored dates are date-only, such as created_date '2025-07-26', with no time component at all. Converting those to local can move them a day. Date-only values must render unchanged, with no timezone conversion and no misleading hover.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Web timestamps that carry a time render in the viewer's local timezone
- [ ] #2 Each converted timestamp carries the canonical UTC value in its title attribute, so hovering shows the stored value with a UTC marker
- [ ] #3 Date-only values render unchanged, with no timezone conversion and no UTC hover claiming a time the record does not have
- [ ] #4 The configured dateFormat still governs how the displayed value is arranged
- [ ] #5 CLI, TUI and plain output are unchanged and still display UTC
- [ ] #6 Every web surface showing a stored date goes through one shared helper rather than converting per component
- [ ] #7 Tests cover a timestamp in a non-UTC timezone, a date-only value, and the dateFormat interaction
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
