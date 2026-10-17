---
id: BACK-726
title: Show the last modified date on web board cards
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-12 06:09'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1067'
  - src/web/components/TaskCard.tsx
modified_files:
  - src/web/components/TaskCard.tsx
  - src/test/web-task-card-dates.test.tsx
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
- [x] #1 Each web board card shows the task's last modified date next to the created date, labelled so it is distinguishable from it. Both dates use the web UI's shared compact date style: today, yesterday or a number of days ago by local calendar day for a date less than a week old, an absolute date in the project's date format for an older date, and the full stored value on hover for a stored timestamp.
- [x] #2 A card for a task with no updated date shows nothing for last modified.
- [x] #3 No field is added to any API response; the card uses the updated date that the board's task list response already provides.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Research findings
- The board card renders from the Task object the board already holds. The board loads it from GET /api/search (src/web/App.tsx:417 and :657, apiClient.search()), whose task results are the full Task (src/core/search-service.ts:244 `task: entity.task`). GET /api/tasks (handleListTasks, src/server/index.ts:810 `Response.json(tasks)`) returns the same full Task objects. Both carry `updatedDate` (parsed at src/markdown/parser.ts:214; `Task.updatedDate?: string` at src/types/index.ts:53). No API, fetch or loader change is needed.
- Existing element being extended: the created date in the card footer row of src/web/components/TaskCard.tsx, followed by an optional `Due: <date>` item and the first assignee.
- Shared date renderer: `StoredDate` (src/web/components/StoredDate.tsx) in its compact form, backed by `formatStoredDateForCompactDisplay` in src/web/utils/date-display.ts. The All Tasks table uses it for its Created column. The card already receives the project's date format as its `dateFormat` prop for the due date (Board -> TaskColumn -> TaskCard), so nothing new has to be passed down.
- Wording: the web UI already names this field "Updated" (task detail "Updated:", drafts list "Updated:", statistics "Updated"), and the footer's own labelled item has the form `Due: <date>`.
- Layout check on a real board: adding the updated date as one more item of the justify-between footer row put it in a different place on each card (centre with an assignee, far right without one). Keeping it in one item together with the created date puts it in the same place on every card and still wraps item by item in narrow columns.

Plan
1. TaskCard.tsx: one footer item, `<span className="flex flex-wrap gap-x-2 gap-y-1">`, holds the created date and the optional `Updated:` date. Both are rendered by `<StoredDate value={...} dateFormat={dateFormat} compact />`. The item repeats the row's gaps and inherits its typography and colour. A task without updatedDate shows only the created date.
2. Delete the card's own `formatRelativeDate` (nothing else uses it), so the card has no date formatting of its own.
3. src/test/web-task-card-dates.test.tsx: pin a time zone and derive every stored date from the test clock. Cover today, yesterday across a local midnight, a few days ago and older than a week (absolute, configured format), each for both created and updated, plus a task with no updated date. Every case must fail if the card formats dates itself.
4. Verify: each test file that renders the board or its cards on its own with bun test --timeout=10000, bunx tsc --noEmit, bun run check ., then a real browser against scratch projects outside the repository at the minimum and normal column widths, in light and dark themes, with footer wrap counts before and after.
5. Simplify pass, record modified files and notes, commit locally.

History
- The first version rendered both dates with the card's own relative formatter ("3w ago", no hover) and left the created date untouched. After pull request review the decision was to move both dates to the shared renderer. The created date changes too, on purpose, so the two dates stay in one style.

Out of scope (unchanged): API responses, the card's accessible name, TUI/CLI/MCP output, list and detail views, config, dependencies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
What changed
- src/web/components/TaskCard.tsx: the footer's created date and the optional `Updated:` date share one footer item and are both rendered by the shared `StoredDate` component in its compact form, with the `dateFormat` prop the card already received for its due date. The item repeats the footer row's gaps (gap-x-2 gap-y-1) and inherits its typography and colour, so the two dates have an identical computed style (10px, weight 400, gray-400 in light, gray-500 in dark). A task without updatedDate shows only the created date.
- Deleted from TaskCard.tsx: the card's own `formatRelativeDate` helper ("3w ago", "3mo ago", "1y ago", counted in elapsed 24 hour periods, no hover). Nothing else used it. The card now has no date formatting of its own, and the shared formatter in src/web/utils/date-display.ts is the only relative-date code left in src/web.
- src/test/web-task-card-dates.test.tsx: renders the card in a pinned time zone (Asia/Tokyo) with stored dates derived from the test clock, and asserts each date's text and hover. Cases: today, late last night (yesterday by local day although less than 24 hours old), the past week counted in local days, older than a week (absolute local day in a configured dd/mm/yyyy format, hover keeping the stored UTC day), each for created and updated, plus a task with no updated date. All five cases fail against the card's old formatter (checked by temporarily restoring the previous card file).

What users see
- A date less than a week old reads today, yesterday or "Nd ago" by local calendar day. A task changed at 22:00 last night reads "yesterday" the next morning, where the old card formatter said "today".
- An older date shows as an absolute date in the project's date format (date part only), where the created date used to read "3w ago", "3mo ago" or "1y ago". This changes the created date on every card, including cards with no updated date.
- A stored timestamp shows its full stored value, marked (UTC), on hover. A date-only stored value has no time and gets no hover, as elsewhere in the web UI.
- Example, task created three weeks ago and updated two days ago: before `3w ago` `Updated: 2d ago`; now `21/09/2026` `Updated: 2d ago` in a dd/mm/yyyy project (`2026-09-21` `Updated: 2d ago` in a yyyy-mm-dd project), with hovers `21/09/2026 06:05 (UTC)` and `10/10/2026 06:05 (UTC)`.

Payload check (no API change)
- The board loads tasks from GET /api/search (src/web/App.tsx:417, :657); its task results are the full Task (src/core/search-service.ts:244). GET /api/tasks (src/server/index.ts:810) returns the same objects. The branch changes no server or API file. On the scratch copy used below the payload carried updatedDate for 70 of 105 tasks and the board showed "Updated:" on exactly those 70 cards.

Why one grouped item instead of one more footer item
- Added as a sibling of the created date, like `Due:`, the row's justify-between put the updated date in the centre on cards with an assignee and at the far right on cards without one. Grouped with the created date it sits in the same place on every card and still wraps item by item when a column is very narrow.

Footer wrapping, measured before and after the move to the shared renderer
- Measured in a browser on a scratch copy of this repository's backlog folder outside the repository: 105 cards, 70 with an updated date, 69 with an assignee, 57 with both, none with a due date. Both measurements were taken on the same day.
- Minimum column width (16rem columns, footer 193px): 9 of 105 footers wrapped before, 56 of 105 wrap now. In every case it is the assignee that moves to a second footer line; 56 of the 57 cards with both an updated date and an assignee do this (the exception reads `2026-08-15` `Updated: 5d ago` with a short assignee). The created and updated dates stay together on one line on all 70 cards; the widest pair is 177px.
- Normal width (1440px window, three columns, footer 285px): 0 of 105 wrapped before, 0 wrap now.
- A card with both a due date and an assignee still wraps the assignee to a second line at a normal width (seen on a scratch fixture at a 276px footer), as it did before the move.
- Milestone lanes in a 900px window (columns 123px, footer 94px): 79 of 105 footers wrapped before, 82 wrap now. The two dates stack on separate lines on all 70 cards in both. New at this width: `Updated:` followed by an absolute date is about 108px wide, so it breaks after the colon on 62 cards, where none broke before on this copy. The card header already overlaps at this width without this task.

Browser check
- Built-in browser pane, viewer time zone Europe/Vienna, light and dark themes, on the scratch copy above (project format yyyy-mm-dd hh:mm) and on a two-column scratch fixture with dates relative to now (project format dd/mm/yyyy).
- Fixture at a normal width: `21/09/2026` alone for a never modified task; `5d ago` `Updated: yesterday` for a task changed at 22:00 the night before, ten hours earlier; `21/09/2026` `Updated: 2d ago` with the assignee at the right on one line; `28/09/2026` `Updated: today`. At the minimum width the same card reads `21/09/2026` `Updated: 2d ago` with the assignee on a second line.
- The ID, title, labels and progress ring do not move. Both themes show the same layout.

Checks
- Each of the 15 test files that render the board or its cards run on its own with bun test --timeout=10000: 152 pass, 0 fail. src/web/utils/date-display.test.ts (the shared formatter): 17 pass.
- bunx tsc --noEmit: exit 0. bun run check .: 431 files, no fixes.
- Biome coverage: Biome's configured file set (`files.includes` in biome.json) covers `.ts` only, so neither changed `.tsx` file is linted or formatted by it. Running Biome on the two paths directly reports both as ignored. Their formatting was checked by reading them; bunx tsc --noEmit does cover both.

Choices recorded
- Wording: "Updated:" (matches the task detail, drafts list and statistics wording, and the footer's own `Due:` form) rather than the issue's "Last modified".
- Not done, would change existing layout: anchoring the assignee to the right when it wraps (it wraps to the left, with or without this task), and keeping `Updated:` and its date on one line in very narrow lanes.
- Not touched: the card's accessible name, which has never included the created or due date.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web board cards now show when a task was last updated, beside the created date. Both dates are rendered by the web UI's shared compact date renderer, the one the All Tasks table uses for its Created column.

What users see
- A date less than a week old reads today, yesterday or a number of days ago, by local calendar day. An older date shows as an absolute date in the project's date format. A stored timestamp shows its full stored value on hover.
- A task created three weeks ago and updated two days ago shows `21/09/2026` `Updated: 2d ago` in a dd/mm/yyyy project. A task that was never modified shows only its created date.
- The created date changes on every card: it used to read "3w ago", "3mo ago" or "1y ago" from the card's own formatter and had no hover.

What changed
- src/web/components/TaskCard.tsx: the footer's created date and the optional `Updated:` date share one footer item and both go through `StoredDate` in its compact form, with the date format the card already received for its due date. The card's own `formatRelativeDate` helper is deleted, so the card has no date formatting of its own.
- src/test/web-task-card-dates.test.tsx: renders the card in a pinned time zone with dates derived from the test clock and asserts each date's text and hover for today, yesterday across a local midnight, the past week, older than a week, and a task with no updated date.

No API changed. The board reads GET /api/search, which already returns the full task including the updated date, as does GET /api/tasks.

Verification
- 152 tests pass across the 15 test files that render the board or its cards, each run on its own. All five card date cases fail against the card's old formatter.
- bunx tsc --noEmit exits 0. bun run check . passes, with the caveat that Biome's file set covers .ts only, so the two changed .tsx files are not linted or formatted by it.
- Checked in a browser in light and dark themes on scratch projects outside the repository, at the minimum and normal column widths.

Risks and choices to confirm
- Footer wrapping at the minimum column width (16rem): on a scratch copy of this repository's backlog, 56 of 105 cards now wrap the assignee to a second footer line, up from 9 of 105 with the card's own formatter, because an absolute date is wider than "3w ago". The created and updated dates stay together on one line on every card. At a normal three-column width nothing wraps, except a card that has both a due date and an assignee.
- The label is `Updated:`, not the issue's "Last modified". It matches the task detail, drafts list and statistics wording.
<!-- SECTION:FINAL_SUMMARY:END -->
