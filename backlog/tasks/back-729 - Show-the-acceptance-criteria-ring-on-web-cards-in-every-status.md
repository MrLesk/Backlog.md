---
id: BACK-729
title: Show the acceptance-criteria ring on web cards in every status
status: Done
assignee:
  - '@codex-729'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-16 07:08'
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
Web cards show the acceptance-criteria ring only while a task is In Progress. Projects with custom statuses, for example an Awaiting test column where a reviewer ticks criteria one by one, never see progress on those cards, even at 4 of 6 checked (issue #1072, 1.53.0).

Show the ring whenever a task has at least one acceptance criterion, in every web status, including the first, custom, and final statuses. Board cards and All Tasks rows share this rule. In All Tasks, show the ring inline before the title without adding row height, and reserve the ring slot across mixed lists so titles stay aligned. Let board headers wrap the ring and priority group when needed so type and project badges stay readable. Keep the existing ring style and count.

No status configuration, TUI progress behavior, CLI/MCP progress behavior, or ring redesign is part of this task.
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

Current-main repair (2026-10-16, @codex-729):
1. Preserve original PR head e2c504e4b24725315daa9bf281ea8602a828d4ec and integrate origin/main 9c0db268894c60ce125458796c2f116468e22b8b by merge, leaving the occupied PR worktree and protected BACK-767 branch untouched.
2. Keep the single shared ring rule and all six current PR acceptance criteria. Match the description to the existing board and All Tasks scope. Inspect the merge and make only a verified in-scope repair; report any material layout or workflow choice before changing it. Assess mixed-list alignment for supported three-digit counts.
3. Run existing rendered-output and related web card/list tests, type checking, repository checks, build, and compiled HTTP/browser smoke. Seek bounded current narrow/wide and light/dark layout evidence. Retain original measured evidence only for unchanged markup/style bytes and report browser access limits honestly.
4. Review the main-relative change and original feature patch for scope and simplification. Provide stable source/test hashes and evidence for contextual architecture review before final task proof, commit, or protected publication.

Routine AC5 repair approved for implementation: derive the largest criteria-total digit count from sortedDisplayTasks using the existing shared visibility/count function. Every visible row receives one common slot width, keeping 3rem exactly through two digits and adding two tabular digit widths per extra digit. Keep the counter font, inline placement, filtering behavior, and board markup unchanged. Add rendered regression coverage for mixed counts and the return to existing small-count slot width after the larger row is removed, then measure actual title positions at narrow/wide widths with three- and four-digit valid criteria counts.
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

Current-main repair: origin/main 9c0db268894c60ce125458796c2f116468e22b8b merged without conflicts into exact PR head e2c504e4b24725315daa9bf281ea8602a828d4ec. The task description now matches the existing six accepted web criteria. No manual source repair has been made.

Current-main verification (2026-10-16): 88 focused web tests across 9 files pass; check:types checks 564 files without errors; bun run check . checks 459 files without fixes; bun run build passes. Original feature source/test patch-id remains af3bf33656dbc7c64fe309a9096509afcf9266e5. Compiled HTTP smoke returns 200 for /board, /tasks, /api/tasks, /api/statuses and embedded CSS/JS. The current hidden in-app browser works. Valid 100/100 criteria expose an existing AC5 defect: slot width is 60.59375px and title x=513.59375, while 99/99 and no-criteria rows reserve 48px and title x=501. The 12.59375px difference is the same at 1024px and 1920px in light and dark. AC5 is unchecked until repaired. No manual source change has been made; bounded shared-slot repair plan has been returned for review.

AC5 repair proof (2026-10-16): TaskList now derives the largest visible criteria-total digit count from sortedDisplayTasks through the same shared count function and gives every visible row one width. The slot keeps 3rem (48px at the default font size) through 99/99 and adds room for both counter numbers for larger totals, using the existing 10px medium tabular-number font. No state, effect, exported helper, new column, count limit, or board change was added.

89 distinct focused tests across 9 files pass: progress 21, list width 4, card dates 5, task types 11, projects 9, readiness 1, list labels/filter/sorting 19, column sorting 7, board filters 12. The three changed-list-related files were rerun after the repair (44 tests); the six other files passed on the unchanged merged board source. The new rendered-output regression covers mixed no-criteria, small, 99/99, 100/100 and 1000/1000 rows, correct counts, shared slot widths and restoration of the small-count width when the wider row leaves. It does not duplicate the sizing formula in its expectations.

Final checks: bun run check:types passes for 564 files; bun run check . passes for 459 files with no fixes; bun run build passes; main-relative git diff --check is clean. Biome still does not include TSX files under the repository config. Fresh compiled HTTP smoke returns 200 for /board, /tasks, /api/tasks, /api/statuses and the embedded CSS/JS. Task API counts match all fixture counts through 1000/1000.

Fresh compiled browser measurements at 1024px and 1920px, light and dark: all nine mixed rows, including 100/100 and 1000/1000, reserve 73.921875px and start titles at x=526.921875; the largest ring is 73.6875px and fits. A supported status filter that removes the larger rows while retaining 99/99 restores all three visible rows to exactly 48px and title x=501. Rings remain inline, with no additional line. Existing board header and ring markup/style bytes are preserved from the original PR, so its recorded narrow/wide/theme board layout evidence remains applicable. The current compiled board also shows the first/custom/final status counts and no ring for zero criteria. Hidden in-app browser checks succeeded; its viewport override was reset and temporary tab closed.

Subtraction review: relative to current main, only the original four web source/test files and this task record change. Integration keeps main sorting, dates, lifecycle, archive and metadata behavior. Relative to the original feature, only TaskList shared slot sizing and one regression/helper change were added. A smaller implementation would either leave valid larger-count rows misaligned or change the accepted placements. The current implementation uses derived presentation values in the existing list and retains one shared ring visibility/count rule. Task finalization and publication await contextual KEEP.

Final full-context architecture review: KEEP on the exact reviewed source/test hashes, with no further source change or material decision. All six acceptance criteria and all three Definition of Done items are supported by the recorded rendered-output, related web, build, HTTP and browser evidence. Source/test bytes are frozen for the merge commit and protected publication.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web UI shows the acceptance-criteria ring whenever a task has at least one criterion, in every status, including the first, custom and final statuses. Tasks without criteria show no ring. Board cards and All Tasks rows share one visibility/count rule, and the ring style and counts stay the same.

All Tasks places the ring inline before the title without adding a line. Every visible row reserves one shared slot while any row has a ring. The slot stays exactly 48px at the default font size through 99/99 and grows for larger visible counts. Filtering out the larger rows restores the small-count width. This repairs the original PR alignment gap for valid 100/100 and larger counts without adding state, effects, a new column, a count limit or an exported helper.

Board headers wrap the ring and priority group when needed to keep type and project badges readable; headers that fit remain on one line. The original ring and board header markup/style bytes are preserved. Current main was integrated without conflicts, retaining its date, sorting, lifecycle and metadata behavior. The description now matches the existing six web criteria. No status configuration, ring redesign or TUI/CLI/MCP progress change was added.

Verification: 89 distinct focused tests pass across 9 files, including 21 progress tests and a rendered regression for mixed counts through 1000/1000 and restoration after the larger task leaves. The three list-related files were rerun after the repair (44 tests). Type checking passes for 564 files; repository checks pass for 459 files; build and main-relative diff checks pass. Biome does not include TSX files under the current repository config. Rebuilt compiled HTTP checks return 200 for board/tasks routes, task/status APIs and embedded CSS/JS.

Fresh compiled browser checks at 1024px and 1920px in light and dark show every mixed-list title at the same x position with 100/100 and 1000/1000 counts. Filtering to smaller counts restores the exact 48px slot and matching title positions. The current compiled board shows rings in first/custom/final statuses and none for zero criteria. The unchanged board/header/ring bytes retain the original recorded narrow/wide/theme layout evidence and its stated very-narrow milestone-grid limitation. Temporary browser and server resources were cleaned up.

Full-context review returned KEEP on the exact source/test hashes with no further source change requested.
<!-- SECTION:FINAL_SUMMARY:END -->
