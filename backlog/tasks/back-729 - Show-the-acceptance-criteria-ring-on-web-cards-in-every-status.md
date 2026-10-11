---
id: BACK-729
title: Show the acceptance-criteria ring on web cards in every status
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:04'
labels:
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1072'
  - src/web/components/AcceptanceCriteriaProgress.tsx
modified_files:
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/test/web-task-acceptance-progress.test.tsx
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
2. No edits to the two callers. `TaskCard.tsx` (board card header, plus the card's accessible name) and `TaskList.tsx` (All Tasks row, under the title) both render this component and read the same function, so both placements follow the rule with no per-placement branch.
3. Tests in `src/test/web-task-acceptance-progress.test.tsx`, through rendered output: a board card with criteria in the first status, a custom middle status (Awaiting test) and the final status each shows the ring with its own count, and the same for All Tasks rows; a task with no criteria shows no ring. Update the tests that encode the old rule (the In Progress wording, and status overrides that existed only to suppress the ring) instead of leaving contradictory ones.
4. Verify: scoped `bun test --timeout=10000 src/test/web-task-acceptance-progress.test.tsx`, `bunx tsc --noEmit`, `bun run check .`, then load the real board in a browser on a spare port with custom statuses and tasks in each column.
5. Out of scope, reported only: TUI bar, --plain and MCP list suffix keep their current behavior. No config option, no ring redesign.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-729-ring-every-status.

Change: `getAcceptanceCriteriaProgressCounts` in `src/web/components/AcceptanceCriteriaProgress.tsx` no longer looks at status. It returns counts for any task with at least one acceptance criterion and null otherwise. Removed the `normalizeStatus` helper and `status` from the component's `Pick<Task, ...>` types. `TaskCard.tsx` and `TaskList.tsx` are unchanged; both read this one function.

Web placements of the ring (both follow the rule):
- Board card header (`TaskCard.tsx`, rendered by `TaskColumn`): ring now in every column. The card's accessible name also gains the progress sentence in every status, because it reads the same function.
- All Tasks list (`TaskList.tsx`): ring on its own line under the title, now on every row with criteria.
- Not present on the Milestones page, Drafts list, Statistics or the task details modal.

Tests (`src/test/web-task-acceptance-progress.test.tsx`): added rendered-output cases for a card and a list row in the first status (To Do 0/3), a custom middle status (Awaiting test 4/6) and the final status (Done 5/5), plus a list row without criteria. The six status cases fail against the previous rule. Renamed the tests that named In Progress or 'no progress' and dropped their To Do overrides, which only existed to suppress the ring.

Checks: scoped test file 18 pass; `bunx tsc --noEmit` exit 0; `bun run check .` clean.

Seen on the real board (throwaway projects served with `bun run cli browser --no-open`, dark and light theme, 1024px and 375px wide):
- Custom statuses To Do / In Progress / Awaiting test / Awaiting decision / Done: every card with criteria shows the ring with the right count in each column (0/3, 1/2, 4/7, 4/6, 1/2, 3/3, 5/5, 12/12); cards without criteria show none. Same on All Tasks rows.
- A copy of this repository's 105 board tasks: all 105 cards show a ring. To Do is 49 empty tracks (0/N), Done is 53 complete rings and one 6/7.

For review, not changed here:
- Card header squeeze. On the five-column board a card is 222px wide and its header shares 193px between id, type badge, project badge, ring and priority. With the ring present the type and project badges shrink first: 'feature' and 'storefront' render as 'f.' and 's..' beside 4/6 + High, and as two blank pills beside 12/12 + High. On the repository copy (three columns, side navigation open), 8 cards truncate 'enhancement' with the ring and none without it. In Progress cards already behaved this way; it now applies in every column.
- All Tasks row height. A row with the ring is about 65px, without it about 46px. On the repository copy the table body grows from 4777px to 6877px (about 44%).

Other surfaces, unchanged:
- TUI bar: still In Progress only. `src/ui/acceptance-criteria-progress.ts:47` returns '' unless `isInProgress` (line 17, exact 'in progress' after trim and lowercase); used by the TUI board (`src/ui/board.ts:175`) and task list (`src/ui/task-viewer-with-search.ts:85`).
- `task list --plain` and MCP list/search lines: ' (ac: checked/total)' in every status, no status check (`src/ui/acceptance-criteria-progress.ts:31`, called from `src/cli.ts:321` and `src/mcp/tools/tasks/handlers.ts:112`).

Check coverage: Biome's `files.includes` lists `src/**/*.ts`, so `bun run check .` and the pre-commit hook do not read the two changed `.tsx` files. Run under the same rules with `.tsx` included, the test file is clean and the component reports one formatting finding on the unchanged component signature (lines 28-32), none on changed lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web UI now shows the acceptance-criteria ring for any task that has at least one acceptance criterion, in every status. A task with no criteria shows no ring. Before, the ring appeared only while a task was In Progress, so projects with custom statuses such as Awaiting test never saw progress on those cards (issue #1072).

What changed:
- `getAcceptanceCriteriaProgressCounts` in `src/web/components/AcceptanceCriteriaProgress.tsx` is the one place that decides whether the ring shows. It no longer reads the task status. The status helper and the `status` field in the component's types are gone.
- Scope is wider than the task text. The task says web board cards, but the All Tasks list rows use the same component, so they changed too: every row with criteria now shows the ring. Board cards also include the progress in their accessible name in every status.
- No config option was added and the ring itself looks and counts as before.

Verification:
- `bun test --timeout=10000 src/test/web-task-acceptance-progress.test.tsx`: 18 pass. New rendered-output cases cover a card and a list row in the first status, a custom middle status and the final status, and a list row without criteria; the unchanged In Progress cases still pass.
- `bunx tsc --noEmit` and `bun run check .` pass. Biome does not cover `.tsx` files today, so it does not read the two changed files.
- Checked in a browser on a board with custom statuses and on a copy of this repository's tasks, in both themes and at phone width.

Visible consequences:
- On a five-column board a card is 222px wide. With the ring in the header, the type and project badges truncate first; with a ring, a priority badge and both badges they can shrink to blank pills. In Progress cards already behaved this way.
- An All Tasks row with a ring is about 65px tall against 46px without. On a copy of this repository's 105 tasks the table body grew from 4777px to 6877px, about 44%.

Not changed: the TUI bar still shows progress for In Progress tasks only. Plain and MCP task lists already show the count in every status.
<!-- SECTION:FINAL_SUMMARY:END -->
