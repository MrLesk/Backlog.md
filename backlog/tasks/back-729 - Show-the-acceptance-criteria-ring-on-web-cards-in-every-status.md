---
id: BACK-729
title: Show the acceptance-criteria ring on web cards in every status
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-12 06:12'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1072'
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskCard.tsx
modified_files:
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/test/web-task-acceptance-progress.test.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskCard.tsx
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
- [x] #1 A web board card shows the acceptance-criteria ring whenever its task has at least one acceptance criterion, in every status: the first status, the final status, and any custom status.
- [x] #2 A card for a task with no acceptance criteria shows no ring.
- [x] #3 The ring on In Progress cards looks and counts as it does today.
- [x] #4 An All Tasks row shows the ring whenever its task has at least one acceptance criterion, in every status, inline before the title on the title line, so a row with a ring is the same height as a row without one.
- [x] #5 In a mixed All Tasks list the titles stay aligned: every row reserves the ring slot while any visible row has a ring, and a list with no rings reserves none.
- [x] #6 When a board card header cannot fit the task ID, the type and project badges, the ring and the priority badge on one line, the ring and priority group wraps to a second header line so the badges stay readable; cards that fit on one line look as before.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rule lives in one place: `getAcceptanceCriteriaProgressCounts` in `src/web/components/AcceptanceCriteriaProgress.tsx` returns counts when the task has at least one acceptance criterion and null otherwise. Remove the status check, the `normalizeStatus` helper that only served it, and `status` from the `Pick<Task, ...>` prop and parameter types, so the component cannot depend on status. Document the final rule on the function.
2. Both web placements render this component and read the same function, with no per-placement rule or status branch: the board card header (`TaskCard.tsx`, plus the card's accessible name) and the All Tasks row (`TaskList.tsx`).
3. All Tasks list: place the ring inline in the title cell's existing flex row, before the title, so it adds no line. The ring sits in a slot of fixed minimum width that every row gets while any visible row has a ring, so titles stay aligned in a mixed list; a list with no rings keeps titles flush left. The slot asks the same function.
4. Board card header: let the header row in `TaskCard.tsx` wrap, reusing the card footer's wrap pattern (`flex-wrap`, `gap-x-2 gap-y-1`), and keep the ring and priority group flush right with `ml-auto`. The group drops to a second header line only when the id, the full badges and the group do not fit on one line; cards that fit are unchanged.
5. Tests in `src/test/web-task-acceptance-progress.test.tsx`, through rendered output: a board card and an All Tasks row with criteria in the first status, a custom middle status (Awaiting test) and the final status each show the ring with its own count; a task with no criteria shows no ring; the list ring is on the title line before the title; a mixed list reserves the slot on every row and a list without rings reserves none; the card header can wrap and its right group stays flush right.
6. Verify: scoped test files one at a time, `bunx tsc --noEmit`, `bun run check .`, then measure row heights and badge widths in a browser at the minimum column width, a normal width and the milestone lane grid, before and after.
7. Out of scope, reported only: TUI bar, --plain and MCP list suffix keep their current behavior. No config option, no ring redesign.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-729-ring-every-status.

Rule: `getAcceptanceCriteriaProgressCounts` in `src/web/components/AcceptanceCriteriaProgress.tsx` no longer looks at status. It returns counts for any task with at least one acceptance criterion and null otherwise. Removed the `normalizeStatus` helper, `status` from the component's `Pick<Task, ...>` types, and the component's `className` prop, which no caller uses any more.

Web placements of the ring (both read the one function):
- Board card header (`TaskCard.tsx`, rendered by `TaskColumn`): ring in every column. The card's accessible name also gains the progress sentence in every status.
- All Tasks list (`TaskList.tsx`): ring on every row with criteria, inline at the start of the title cell.
- Not present on the Milestones page, Drafts list, Statistics or the task details modal.

All Tasks placement:
- The ring moved from its own line under the title into the title cell's existing flex row (`flex items-center gap-2 min-w-0`), before the title button, inside a slot `<span className="flex min-w-12 shrink-0">`.
- Rows without a ring: the slot is rendered on every row while any visible row has a ring (`showProgressSlot`, which asks the same function), and stays empty on rows without criteria. Chosen over letting titles start where they start because ring widths differ (34px for 4/6, 41px for 0/10, 47px for 12/12), so titles would be ragged even among rows that have a ring. With the slot, rings form one column and every title starts at the same x. A list with no rings renders no slot, so its titles stay flush left as before.
- The title button keeps `truncate` and its accessible name (`Open <id>: <title>`); the ring keeps its progressbar role and values. The ring now comes before the title in reading order.

Card header:
- Header row classes changed from `flex items-center justify-between gap-2 mb-1.5` to `flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5`, the wrap pattern the card footer already uses. The ring and priority group changed from `flex shrink-0 items-center gap-2` to `ml-auto flex shrink-0 items-center gap-2`, so it stays flush right on the first line or alone on a second one.
- The group wraps only when the id, the full badges and the group do not fit on one line. This also applies to a card without a ring whose badges were already truncated by the priority badge.

Measured in a browser on scratch projects (five statuses; viewport 1024px and 1920px; light and dark give the same numbers). Before is the ring on its own line and the non-wrapping header:
- All Tasks row height: with a ring 65-66px before, 46px after; without a ring 46px before and after. With a two-line status pill: 66px before with a ring, 62px after, the same as without. With a due date line: 86px before, 61px after.
- All Tasks title: starts at 12px before; 68px on every row after when any visible row has a ring (48px slot plus 8px gap), 12px when none has. At the minimum table width the title cell is 192px, so the title text has 112px instead of 168px. At 1920px the cell is 710px and every title fits.
- A copy of this repository's 105 tasks, all with criteria: table body 6877px before, 4777px after, the height it has with no rings at all.
- Card at the minimum column width (column 256px, card 222px, header 193px), badge text shown of needed: enhancement beside 4/6 and High 42 of 68px before, 68 of 68 after; enhancement beside 0/10 and Med 30 of 68, then 68 of 68; feature and storefront beside 4/6 and High 7 of 36 and 10 of 51, then full; feature and storefront beside 12/12 and High 2 of 36 and 3 of 51, then full; enhancement and storefront beside 12/12 and High 3 of 68 and 2 of 51, then 58 of 68 and 43 of 51 (id and both badges alone are wider than the header); feature and storefront beside High with no ring 24 of 36 and 34 of 51, then full.
- A wrapped header is 43px instead of 20px, so those cards are 23px taller. Cards whose header fits on one line (bug beside 5/5 and Med, ring and priority, ring only, id only) keep the same header and card size.
- Card at 1920px (card 267px, header 238px): enhancement beside 4/6 and High fits on one line before and after; feature and storefront beside 4/6 and High 26 of 36 and 37 of 51 before, full and wrapped after; beside 12/12 and High 21 of 36 and 29 of 51 before, full and wrapped after.
- Repository copy board: 8 cards truncated 'enhancement' before, none after; 8 headers wrap; no header overflows.
- Milestone lane grid at 1024px (cards 79px wide, header 50px): the header already overflowed there. Per-card overflow went from 34 to 26px, 39 to 31px, 30 to 22px, 32 to 24px and 47 to 41px, and is unchanged at 41px, 25px and 0px on the rest. None grew.

Tests (`src/test/web-task-acceptance-progress.test.tsx`, 20 pass): status cases for card and list row; the list ring is on the title line before the title; a mixed list reserves the slot on every row and a list without rings reserves none; the header row can wrap and the right group is flush right. Six of them fail against the previous layout. jsdom has no layout, so the wrap and the row height are pinned by class and structure and confirmed by the browser measurements above.

Checks: `bunx tsc --noEmit` exit 0; `bun run check .` clean. Biome's `files.includes` lists `src/**/*.ts`, so it and the pre-commit hook do not read `.tsx` files. Run under the same rules with `.tsx` included, the component and the test file are clean, and the changed lines of `TaskList.tsx` report nothing.

Other surfaces, unchanged:
- TUI bar: still In Progress only. `src/ui/acceptance-criteria-progress.ts:47` returns '' unless `isInProgress` (line 17, exact 'in progress' after trim and lowercase); used by the TUI board (`src/ui/board.ts:175`) and task list (`src/ui/task-viewer-with-search.ts:85`).
- `task list --plain` and MCP list/search lines: ' (ac: checked/total)' in every status, no status check (`src/ui/acceptance-criteria-progress.ts:31`, called from `src/cli.ts:321` and `src/mcp/tools/tasks/handlers.ts:112`).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web UI now shows the acceptance-criteria ring for any task that has at least one acceptance criterion, in every status. A task with no criteria shows no ring. Before, the ring appeared only while a task was In Progress, so projects with custom statuses such as Awaiting test never saw progress on those cards (issue #1072).

What changed:
- `getAcceptanceCriteriaProgressCounts` in `src/web/components/AcceptanceCriteriaProgress.tsx` is the one place that decides whether the ring shows. It no longer reads the task status. The status helper, the `status` field in the component's types and its unused `className` prop are gone.
- Scope is wider than the original task text. The task said web board cards, but the All Tasks list rows use the same component, so they are covered too: every row with criteria shows the ring.
- All Tasks rows: the ring sits inline at the start of the title cell, before the title, so a row with a ring is the same height as a row without one. While any visible row has a ring, every row reserves the same 48px slot, so titles stay aligned in a mixed list; a list with no rings reserves nothing.
- Board cards: the header row can wrap. When the id, the type and project badges, the ring and the priority badge do not fit on one line, the ring and priority group moves to a second header line, flush right, instead of squeezing the badges. Cards that fit on one line are unchanged. Board cards also include the progress in their accessible name in every status.
- No config option was added and the ring itself looks and counts as before.

Verification:
- `bun test --timeout=10000 src/test/web-task-acceptance-progress.test.tsx`: 20 pass. Rendered-output cases cover a card and a list row in the first status, a custom middle status and the final status, the ring's place on the title line, the slot in mixed and ring-free lists, and the wrapping header; the unchanged In Progress cases still pass.
- `bunx tsc --noEmit` and `bun run check .` pass. Biome does not cover `.tsx` files today, so it does not read the changed web files.
- Measured in a browser at the minimum column width, a wide viewport, the milestone lane grid and phone width, in both themes.

Visible consequences:
- All Tasks rows with a ring are 46px tall, the same as rows without one (65px while the ring had its own line). On a copy of this repository's 105 tasks the table body is 4777px, the same as with no rings.
- When any visible row has a ring, titles start 56px further right. At the minimum table width the title text has 112px instead of 168px and truncates sooner.
- A card whose header wraps is 23px taller. At the minimum column width (card 222px) that is any card with a ring, a priority and a long type badge or both badges; their badges are now readable in full, except that an id with two long badges is still wider than the header and truncates slightly. A card without a ring whose badges were truncated by the priority badge wraps in the same way.

Not changed: the TUI bar still shows progress for In Progress tasks only. Plain and MCP task lists already show the count in every status.
<!-- SECTION:FINAL_SUMMARY:END -->
