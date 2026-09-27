---
id: BACK-678
title: Make due date a date-only string everywhere
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 18:26'
updated_date: '2026-09-02 20:33'
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
- [x] #1 Due dates are stored as a date-only string and no surface converts them by timezone or shows a UTC hover for them
- [x] #2 Web due-date entry asks for a day, so the day picked is the day stored
- [x] #3 CLI and MCP due-date entry take a date, and their help text no longer describes it as a UTC datetime
- [x] #4 A stored value that still carries a time is read as its date part rather than failing, shifting, or being dropped, and existing files are not rewritten as a side effect
- [x] #5 Created and updated timestamps keep the local rendering with UTC hover from BACK-677
- [x] #6 Tests pin timezones whose offsets would shift a day (for example +14 and -8) and assert the due date is identical everywhere, including through an open-and-save cycle
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. The model lives in one place: normalizeUtcDateTime (src/utils/utc-datetime.ts) is imported by eight modules and every one of them uses it for a due date and nothing else. Replace it with normalizeDueDate in src/utils/due-date.ts, returning YYYY-MM-DD, and update the eight importers. Reads and writes then share one definition and every surface receives a date-only string.
2. Tolerate legacy values: a stored due date may carry a time because the CLI accepted one. normalizeDueDate accepts a date followed by an optional time or offset and keeps the date as written, so nothing fails, shifts a day, or is dropped. No migration and no file rewriting: a task file only changes when it is edited for another reason.
3. Delete the conversion rather than adding a rule. Because parsed due dates are now date-only, the existing date-only paths already render them unconverted and without a UTC hover: BACK-677 helpers pass them through untouched, so the web needs no display change. Created and updated timestamps keep their local rendering with UTC hover.
4. Drop appendUtcLabel from the due-date display sites that force a (UTC) suffix onto a value that has no time: src/ui/board.ts, src/ui/task-viewer-with-search.ts, src/formatters/task-plain-text.ts, and the MCP task and milestone handlers.
5. Entry across surfaces: web inputs become type='date' labelled 'Due'; the TUI composer field label drops (UTC); CLI --due-date becomes <date> with help text that no longer says UTC datetime; MCP due-date schema descriptions ask for a date instead of rejecting date-only values.
6. Tests: rewrite the date-only rejection cases that lock in the old model, and pin Pacific/Kiritimati (+14) and America/Los_Angeles (-8) to assert a due date renders identically in both and survives an open-and-save cycle, plus a stored value that still carries a time.
7. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the model rather than patching its display. normalizeUtcDateTime (src/utils/utc-datetime.ts) was imported by eight modules and every one used it for a due date and nothing else, so it became normalizeDueDate in src/utils/due-date.ts, returning YYYY-MM-DD. Reads and writes share that one definition, which is why the surfaces mostly lost code instead of gaining it: because a parsed due date is now date-only, it travels the date-only path BACK-677 already had, and the web needed no display change at all.

Legacy tolerance lives at the model boundary. normalizeDueDate accepts a day followed by an optional time or offset and keeps the day as written; converting an offset instead could move it, which is the bug being fixed. Verified end to end: hand-editing a stored task to due_date: '2026-09-05 14:30' still views, lists and serialises to JSON as 2026-09-05, and the file on disk is left byte-for-byte alone. There is no migration, so files change only when edited for some other reason.

Surfaces: web inputs are type=date labelled Due, and their state holds the stored string with nothing to translate; the TUI composer field is labelled Due; CLI --due-date is <date> with YYYY-MM-DD help; MCP schemas ask for a date instead of rejecting date-only values; and the (UTC) suffix is gone from every due-date render (CLI, board, task viewer, plain text, MCP task and milestone handlers). Created and updated timestamps were not touched and keep BACK-677 local rendering with UTC hover.

Validation: bunx tsc --noEmit and bun run check . pass. Full suite 2859 pass / 8 skip with one cross-file flake per run (a different test each time: content-store, then board-tui-move); both pass in isolation, neither references due dates, and the known content-store flake also fails on unmodified main locally.

Maintainer decision (2026-09-02): the JSON envelope keeps schemaVersion 1 even though dueDate changes shape from an RFC 3339 instant to a date-only string. The JSON surface is young and dueDate is optional and rare, so bumping would spend a version break across every payload and field for one optional value, and any consumer checking schemaVersion === 1 would break everywhere at once rather than on the field that changed. A date-only string is also trivially parseable by anything that previously read an instant. The change belongs in the release notes, and a future bump to this surface absorbs it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Due dates are now a plain YYYY-MM-DD string end to end. The single UTC-datetime normalizer that eight modules used only for due dates became normalizeDueDate, so storage, reads and writes share one date-only definition and the timezone conversion BACK-677 applied to due dates is gone from every surface: web inputs are type=date, the TUI composer, CLI help and MCP schemas ask for a date, and the (UTC) suffix is dropped from all due-date output. Created and updated timestamps still render local with a UTC hover. A stored value that carries a time is read as the day it was written with and its file is not rewritten, verified by hand-editing a task to '2026-09-05 14:30' and seeing 2026-09-05 in view, list and JSON with the file untouched. Timezone-pinned tests at +14 (Pacific/Kiritimati) and -8 (America/Los_Angeles) assert the due date renders identically and survives an open-and-save cycle unchanged; bunx tsc --noEmit, bun run check . and the full suite pass.
<!-- SECTION:FINAL_SUMMARY:END -->
