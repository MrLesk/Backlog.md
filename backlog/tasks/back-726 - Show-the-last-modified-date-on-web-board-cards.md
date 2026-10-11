---
id: BACK-726
title: Show the last modified date on web board cards
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:08'
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
- [x] #1 Each web board card shows the task's last modified date next to the created date, in the same relative style, and distinguishable from the created date.
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
- The board card renders from the Task object the board already holds. The board loads it from GET /api/search (src/web/App.tsx:417 and :657, apiClient.search()), whose task results are the full Task (src/core/search-service.ts:244 `task: entity.task`). GET /api/tasks (handleListTasks, src/server/index.ts:810 `Response.json(tasks)`) returns the same full Task objects. Both carry `updatedDate` (parsed at src/markdown/parser.ts:214; `Task.updatedDate?: string` at src/types/index.ts:53). Checked against the running server: 82 of 120 tasks carry updatedDate in both responses, 38 have none. No API, fetch or loader change is needed.
- Existing element being extended: the created date in the card footer row of src/web/components/TaskCard.tsx. It is a bare relative value from the card's own `formatRelativeDate` helper ("today", "yesterday", "2d ago", "3w ago", "3mo ago", "1y ago"), followed by an optional `Due: <date>` item and the first assignee. The created date has no hover/full-date affordance today.
- Existing pattern being reused: the footer's labelled item (`Due: <date>`) for the wording form, and the row's own typography (text-[10px]), colour (text-gray-400 / dark:text-gray-500) and gaps (gap-x-2 gap-y-1), all inherited.
- Wording: the web UI already names this field "Updated" (task detail "Updated:", drafts list "Updated:", statistics "Updated").
- Layout check on the real board: adding the updated date as one more item of the justify-between footer row put it in a different place on each card (centre with an assignee, far right without one). Keeping it in one item together with the created date puts it in the same place on every card and still wraps item by item in narrow columns.

Plan
1. In TaskCard.tsx, wrap the created-date span in one footer item that also holds the conditional updated date: `<span className="flex flex-wrap gap-x-2 gap-y-1">` containing the existing created span and `{task.updatedDate && <span>Updated: {formatRelativeDate(task.updatedDate)}</span>}`. Same helper, same gaps as the row, no new props, no new component. A task without updatedDate shows exactly what it shows today.
2. Do not add a hover/full date: the created date beside it exposes none, and the task says to mirror the created date. Report this as an open design choice (the issue asked for the full date on hover).
3. Add src/test/web-task-card-dates.test.tsx: render TaskCard and assert on rendered text. A task whose updated date is derived from the test clock as two days ago shows "Updated: 2d ago" beside the created value; a task with no updated date shows only the created value and no "Updated" text. No calendar dates are hardcoded.
4. Verify: bun test --timeout=10000 on the new test file and the existing card test files, bunx tsc --noEmit, bun run check ., then the real board in a browser at a normal column width and at narrow ones, in light and dark themes.
5. Simplify pass, record modified files and implementation notes, commit locally. No push, no PR.

Out of scope (unchanged): API responses, TUI/CLI/MCP output, list and detail views, config, dependencies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-726-card-last-modified (local only, not pushed).

What changed
- src/web/components/TaskCard.tsx: the card footer's created date now shares one footer item with an optional `Updated: <relative>` value, rendered through the card's existing `formatRelativeDate` helper. The item reuses the footer row's own gaps (gap-x-2 gap-y-1) and inherits its typography and colour, so the two dates have an identical computed style (10px, weight 400, gray-400 in light, gray-500 in dark). A task without updatedDate renders only the created date, exactly as before. Footer comment updated to match what the row holds.
- src/test/web-task-card-dates.test.tsx (new): renders TaskCard and asserts the rendered dates. Updated two days ago -> ["5d ago", "Updated: 2d ago"]; no updated date -> ["5d ago"] and no "Updated" text anywhere on the card. All stored dates are derived from the test clock. The first test fails against the unchanged card (checked by temporarily restoring the original file).

Payload check (no API change)
- The board loads tasks from GET /api/search (src/web/App.tsx:417, :657); its task results are the full Task (src/core/search-service.ts:244). GET /api/tasks (src/server/index.ts:810) returns the same objects. Against the running server both carried updatedDate for 82 of 120 tasks; the board then showed "Updated:" on exactly those 82 cards and on none of the other 38.

Why one grouped item instead of one more footer item
- First attempt added the updated date as a sibling of the created date, like `Due:`. On the real board the row's justify-between put it in the centre on cards with an assignee and at the far right on cards without one, so the value jumped around while scanning a column. Grouping it with the created date keeps it in the same place on every card and still wraps item by item when a column is very narrow.

Browser check (Chrome, real project board plus a scratch project with clock-relative dates, light and dark)
- Normal width (1440px window, three columns, footer about 285px): every footer on the real board stays on one line; reads "1mo ago  Updated: 3d ago" at the left with the assignee at the right. Header, title, labels and progress ring do not move.
- Minimum column width (16rem columns, footer 193px): one line when the two dates and the assignee fit, for example "3w ago  Updated: 2d ago  @alex-agent" (fits with under 1px to spare). Longer combinations wrap the assignee to a second footer line (17 of 120 cards on this board, all with assignee names of roughly 60px or more), the same way the footer already wraps for due dates. With a due date the footer becomes two tidy lines: dates above, due date and assignee below.
- A card with both a due date and an assignee needs about 270-330px of footer, so at the 1440px three-column width the assignee wraps to a second line where it previously fit.
- Milestone lanes in a 900px window (columns 123px, footer 94px): the footer stacks as "1mo ago" / "Updated: 3d ago" / "@grok", each phrase intact. "Updated: yesterday" is 0.4px wider than that footer and breaks after the colon (5 cards). The card header already overlaps at this width before this change.

Checks
- bun test --timeout=10000 on the new file plus the eight existing test files that render board cards: 96 pass, 0 fail.
- bunx tsc --noEmit: exit 0. bun run check .: 431 files, no fixes.

Open design choices for review
- Wording: "Updated:" (matches the task detail, drafts list and statistics wording, and the footer's own `Due:` form) rather than the issue's "Last modified", which is about 21px wider and would wrap the assignee on most 16rem cards.
- No full date on hover: the created date beside it has none, and the task says to mirror it. The issue asked for one.
- Not done, would change existing layout: anchoring the assignee to the right when it wraps (it wraps to the left today, with or without this change).

Follow-up after review
- Biome coverage: `bun run check .` passes, but Biome's configured file set (`files.includes` in biome.json) covers `.ts` only, so neither changed `.tsx` file (src/web/components/TaskCard.tsx, src/test/web-task-card-dates.test.tsx) is linted or formatted by it. Running Biome on the two paths directly reports both as ignored. Their formatting follows the surrounding files by hand; `bunx tsc --noEmit` does cover both.
- Comment only: the comment above the dates group in TaskCard.tsx now says the group uses the same gaps as the footer row and that a new labelled relative date belongs inside the group. No markup or class change.
- Re-ran after the comment change, with origin/main unchanged: 96 pass, 0 fail across the new test file and the eight existing files that render board cards; `bunx tsc --noEmit` exit 0; `bun run check .` 431 files, no fixes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web board cards now show when a task was last updated, beside the created date and in the same relative style. A task modified two days ago shows its created value followed by `Updated: 2d ago` (for example `3w ago` `Updated: 2d ago`). A task that was never modified shows only the created value, as before.

What changed
- src/web/components/TaskCard.tsx: the footer's created date and the optional updated date share one footer item. Both go through the card's existing relative-date helper and use the footer row's typography, colour and gaps.
- src/test/web-task-card-dates.test.tsx: renders the card and asserts the dates it shows, with every date derived from the test clock.

No API changed. The board reads GET /api/search, which already returns the full task including the updated date, as does GET /api/tasks.

Verification
- 96 tests pass across the new test file and the eight existing files that render board cards. The new "shows the updated date" test fails against the unchanged card.
- bunx tsc --noEmit exits 0. bun run check . passes, with the caveat that Biome's file set covers .ts only, so the two changed .tsx files are not linted or formatted by it.
- Checked in Chrome on the real board and on a scratch project with clock-relative dates, in light and dark themes: "Updated:" appeared on exactly the 82 of 120 cards whose task has an updated date, in the same style as the created date, and the ID, title, labels and progress ring did not move.

Choices to confirm
- The label is `Updated:`, not the issue's "Last modified". It matches the task detail, drafts list and statistics wording and is about 21px narrower.
- No full date on hover, because the created date beside it has none.
- Footer wrapping: at the minimum column width (16rem) 17 of 120 cards on the real board wrap the assignee to a second footer line. A card with both a due date and an assignee wraps the assignee at the normal three-column width (1440px window), where it previously fit on one line.
<!-- SECTION:FINAL_SUMMARY:END -->
