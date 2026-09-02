---
id: BACK-677
title: Show local time in the web UI with the UTC value on hover
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-02 17:01'
updated_date: '2026-09-02 17:47'
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
- [x] #1 Web timestamps that carry a time render in the viewer's local timezone
- [x] #2 Each converted timestamp carries the canonical UTC value in its title attribute, so hovering shows the stored value with a UTC marker
- [x] #3 Date-only values render unchanged, with no timezone conversion and no UTC hover claiming a time the record does not have
- [x] #4 The configured dateFormat still governs how the displayed value is arranged
- [x] #5 CLI, TUI and plain output are unchanged and still display UTC
- [x] #6 Every web surface showing a stored date goes through one shared helper rather than converting per component
- [x] #7 Tests cover a timestamp in a non-UTC timezone, a date-only value, and the dateFormat interaction
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one shared web helper in src/web/utils/date-display.ts: formatStoredDateForDisplay(value, { dateFormat, timeZone }) returning { text, title? }. It parses the stored value explicitly as UTC (parseStoredUtcDate), converts to the viewer timezone via Intl.DateTimeFormat with an optional explicit timeZone, then reuses formatUtcDateForDisplay to arrange the local wall-clock value with the configured dateFormat. title is the canonical UTC value with the (UTC) marker.
2. Date-only stored values (yyyy-mm-dd) and unparsable values are returned unchanged with no title, so no day shift and no misleading hover.
3. Add a tiny StoredDate component so every web call site renders <span title={utc}>{local}</span> identically instead of converting per component.
4. Route every web stored-date render through it: TaskDetailsModal (Created/Updated/Due/comment dates), TaskList (compact created + Due), TaskCard (Due), DraftsList, Statistics, MilestonesPage (Due), DocumentationDetail, DecisionDetail, CleanupModal.
5. Make the compact list label share the same helper so its absolute fallback and hover match.
6. Rename the visible 'Due (UTC):' display labels to 'Due:' since the value is no longer UTC; the due-date input labels stay 'Due (UTC)' because entry semantics are unchanged.
7. Leave src/utils/utc-date-display.ts callers for CLI, TUI, MCP and plain output untouched, so those surfaces keep appendUtcLabel UTC output.
8. Tests: extend src/web/utils/date-display.test.ts with an explicit timeZone argument (no reliance on the runner timezone) covering a non-UTC timestamp, a date-only value, and the dateFormat interaction; set process.env.TZ explicitly in any component test that asserts a rendered timestamp.
9. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added one shared web helper in src/web/utils/date-display.ts. formatStoredDateForDisplay(value, { dateFormat, timeZone }) returns { text, title? }: text is the stored instant rendered in the viewer's timezone, title is the canonical stored value with the (UTC) marker for the title attribute. formatStoredDateForCompactDisplay returns the same shape for dense lists. Conversion goes through parseStoredUtcDate (explicit UTC parsing, never Date's local parsing of '2026-07-16 21:49') and Intl.DateTimeFormat with hourCycle h23; the resulting local wall-clock string is then arranged by the existing formatUtcDateForDisplay, so the configured dateFormat still governs both the visible value and the hover.

Date-only stored values such as created_date '2025-07-26' never reach the conversion: localCanonicalOf returns null when the canonical value has no time, so the value renders unchanged and carries no title that would claim a time the record does not have. Unparsable values fall back to the previous passthrough behaviour.

Added src/web/components/StoredDate.tsx, a one-line component rendering <span title={utc}>{local}</span>, and routed every web stored-date render through it: TaskDetailsModal (Created, Updated, Due, comment dates), TaskList (compact Created column and Due), TaskCard (Due), DraftsList (Created, Updated), Statistics, MilestonesPage (Due), DocumentationDetail (Created), DecisionDetail (Date), CleanupModal (preview dates). No component converts on its own any more; CleanupModal's and Statistics' local formatDate helpers were deleted.

Deliberate label change: the visible 'Due (UTC):' labels became 'Due:' because the displayed value is no longer UTC and the UTC value is on hover. The due-date entry fields keep their 'Due (UTC)' labels: entry semantics are unchanged, the input still takes and stores a UTC value.

Not changed: src/utils/utc-date-display.ts and every CLI, TUI, MCP and plain-output caller still pass appendUtcLabel and print UTC. TaskCard's relative age label ('3w ago') is timezone-independent and was left alone.

Tests: src/web/utils/date-display.test.ts now passes an explicit timeZone to every case (Asia/Tokyo, America/Los_Angeles, UTC), so nothing depends on the runner's timezone; it covers a non-UTC timestamp, the local-midnight rollover, a date-only value left unconverted with no title, and dateFormat applied to both the local value and the UTC hover. Component tests that assert rendered timestamps pin the timezone through the new src/test/pin-timezone.ts helper (beforeAll/afterAll, restoring the previously resolved zone because bun shares one process across test files): web-task-list-table-width, web-milestones-page-search and web-task-types now render under Asia/Tokyo and assert both the local text and the UTC title, plus a date-only created_date that must not shift. Verified the suite is timezone-independent by rerunning those files under TZ=UTC, America/Los_Angeles and Pacific/Kiritimati.

Validation: bunx tsc --noEmit and bun run check . pass. Full bun run test on this branch: 2852 pass, 8 skip, 1 fail. The single failure is in src/test/content-store.test.ts, which also fails on an unmodified origin/main worktree (2849 pass, 8 skip, 1 fail, different test in the same suite, same 'Unhandled error between tests' with a git posix_spawn ENOENT); both pass when that file runs on its own, so it is a pre-existing flake in that suite and not caused by this change. CI on the PR: lint-and-unit-test passes on macOS and Windows (confirming process.env.TZ pinning works on Windows too), compile-and-smoke-test passes on all three platforms, CodeQL and nix-package pass. The four date-related test files were also rerun under TZ=UTC, TZ=America/Los_Angeles and TZ=Pacific/Kiritimati and pass unchanged.

Manual verification in the running web UI with the browser in Europe/Vienna: BACK-677's stored '2026-09-02 17:01' rendered as '2026-09-02 19:01' with title '2026-09-02 17:01 (UTC)'; the task list's compact column rendered 'today'/'yesterday' with the canonical UTC value on hover; BACK-208's date-only created_date '2025-07-26' rendered unchanged with no title. CLI plain output for the same tasks still prints 'Created: 2025-07-26 (UTC)' and 'Created: 2026-09-02 17:01 (UTC)', and the diff against origin/main touches no file under src/utils/utc-date-display.ts, src/cli.ts, src/ui, src/formatters or src/mcp.

All 10 CI checks on PR 992 pass, including lint-and-unit-test (ubuntu-latest), which runs the full behavioural profile plus the interactive TUI pass. The content-store failure seen locally does not reproduce there, confirming it as a local environment flake.

Review fixes from PR 992 (Codex findings):

1. Pinned the timezone in src/test/web-board-filters.test.tsx, the one remaining test asserting a rendered stored date without a pin. Pre-fix evidence: TZ=Asia/Tokyo bun test src/test/web-board-filters.test.tsx failed with 'Timed out after 4000ms waiting for () => (container.textContent ?? "").includes("09/02/2026 06:01")' because the cleanup preview now renders 15:01 locally. It now pins Asia/Tokyo and asserts both the local text '09/02/2026 15:01' and the title '09/02/2026 06:01 (UTC)'. Swept every test file for assertions on rendered stored dates, relative labels and date-only renders; this was the only unpinned one, the other three were already pinned.

2. Cached the Intl.DateTimeFormat instances in a module-level Map instead of constructing one per StoredDate render. The key is the resolved zone (timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), so a cached formatter is never reused after the runtime zone changes, which is what pinTimeZone does mid-process. Measured: constructing per call was 30.2us/op, reusing a cached formatter is 0.75us/op, and resolving the default zone first costs 1.3us/op; a full formatStoredDateForDisplay render is now 2.42us. Verified the cache follows a runtime zone change: UTC 06:01, Tokyo 15:01, Los Angeles 08 22:01, back to UTC 06:01.

3. The compact label now compares calendar days in the viewer's timezone instead of elapsed hours. Pre-fix evidence: at now=2026-02-21T01:00Z in America/Los_Angeles a stored '2026-02-20 06:00' is locally Feb 19 against a local today of Feb 20, and the 19-hour gap returned 'today' instead of 'yesterday'; the same slip made a Feb 18 stamp read '2d ago' instead of '3d ago'. Both are covered by new tests that failed before the change, alongside a Tokyo case crossing local midnight the other way and a UTC case, since the elapsed-hours bug was not limited to non-UTC viewers.

Gates after the fixes: bunx tsc --noEmit and bun run check . clean; full bun run test 2854 pass, 8 skip, 1 fail (the same pre-existing content-store flake, which still passes in isolation at 67/67). The five date-related test files pass under TZ=UTC, Asia/Tokyo, America/Los_Angeles, Pacific/Kiritimati and Europe/Vienna.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The browser now shows stored timestamps as local time with the canonical UTC value on hover, while the CLI, TUI, MCP and plain output keep printing UTC.

One shared web helper does the work: formatStoredDateForDisplay (and its compact variant) in src/web/utils/date-display.ts returns { text, title }, where text is the stored instant in the viewer's timezone and title is the canonical value marked (UTC). Parsing is explicit UTC rather than Date's local parsing, conversion goes through Intl.DateTimeFormat, and the resulting local wall-clock value is arranged by the existing formatUtcDateForDisplay so the configured dateFormat still governs the output. Date-only values such as created_date '2025-07-26' never reach the conversion, so they render unchanged and carry no hover claiming a time the record does not have. A one-line StoredDate component renders <span title={utc}>{local}</span>, and every web stored-date render was routed through it, removing the per-component formatting in CleanupModal and Statistics. The visible 'Due (UTC):' labels became 'Due:' because the shown value is no longer UTC; the due-date input labels stay 'Due (UTC)' since entry semantics are unchanged.

Verified with tests that pass an explicit timezone (Asia/Tokyo, America/Los_Angeles, UTC) rather than relying on the runner, covering a non-UTC timestamp, the local-midnight rollover, a date-only value with no hover and the dateFormat interaction; with component tests pinned to Asia/Tokyo through the new pinTimeZone helper that assert both the local text and the UTC title; with those files rerun under three more timezones; and by exercising the running web UI from a Europe/Vienna browser, where 17:01 UTC rendered as 19:01 titled '2026-09-02 17:01 (UTC)' and a date-only created_date rendered unchanged. tsc, biome and the test suite pass, apart from a pre-existing content-store flake that fails on origin/main too. PR https://github.com/MrLesk/Backlog.md/pull/992 fixes issue #991.
<!-- SECTION:FINAL_SUMMARY:END -->
