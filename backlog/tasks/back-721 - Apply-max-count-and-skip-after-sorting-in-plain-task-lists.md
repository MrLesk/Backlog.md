---
id: BACK-721
title: Apply --max-count and --skip after sorting in plain task lists
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:42'
updated_date: '2026-10-11 11:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1059'
  - src/cli.ts
  - src/test/cli-list-window.test.ts
  - CLI-INSTRUCTIONS.md
modified_files:
  - src/cli.ts
  - src/test/cli-list-window.test.ts
  - CLI-INSTRUCTIONS.md
  - src/test/cli-pipe-output.test.ts
type: bug
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --plain` takes the `--max-count` and `--skip` window over the status-grouped display order instead of over the sorted list. With `--sort ordinal --max-count 2`, `--json` returns the first two tasks by ordinal, while `--plain` returns two different tasks whenever one of the first two sits in a status group that prints later (issue #1059, reproduced on 1.53.0). The same flags therefore select different tasks depending on the output format, and plain output contradicts the help text, which says the window is taken after filtering and sorting. The older `--limit` option already selects after the sort and only regroups the selected tasks for display.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 For the same filters, `--sort`, `--max-count`, and `--skip`, `backlog task list --plain` lists exactly the tasks that `--json` returns.
- [x] #2 Plain output regroups only the selected tasks by status for display, as `--limit` already does.
- [x] #3 The reproduction from the issue (four tasks with ordinals 10, 20, 30, and 40, the first one In Progress, then `backlog task list --plain --sort ordinal --max-count 2`) lists TASK-1 and TASK-2.
- [x] #4 The shown range, the total, and the printed Next command in plain output agree with the `total` and `nextSkip` that `--json` reports for the same flags.
- [x] #5 `--json` output and `--limit` behavior are unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Cause (reproduced on this branch with the issue's four tasks): `runTaskList` in src/cli.ts flattens the status groups first (`groupTasksByStatus(...).flatMap(...)`) and hands that printed order to `printListWindow`, so `--max-count`/`--skip` cut the status-grouped list. `--json` cuts the sorted list (`selectListWindow(narrowForDisplay(...))`), and `--limit` is applied inside `narrowForDisplay`, before grouping.

1. src/cli.ts, `runTaskList`: give `printListWindow` the same list `--json` windows, the result of `narrowForDisplay` (sorted, narrowed to the parent, shortened by `--limit`). The print callback already groups the tasks it receives by status (`printTasksGroupedByStatus`), which is the path `--limit` uses, so the window's tasks are regrouped for display and nothing else. Delete the pre-grouped `printedTasks` list and replace the comment that says the window follows the printed order. The JSON branch, `--limit`, `--count`, the `--sort priority` flat list and src/utils/list-window.ts stay as they are.
2. Placement for BACK-722: selecting tasks (sort, parent, `--limit`, window) stays one step that plain and JSON share, and grouping by status stays a display step in `groupTasksByStatus`. BACK-722 changes which function orders the list inside the selection step and reuses the grouping from other surfaces; it does not move the window again.
3. CLI-INSTRUCTIONS.md, "Paging long lists": it documents the old behavior for `task list` (the window follows the status groups, and plain and JSON windows differ). Rewrite that part: `task list` takes the window from the sorted list in both plain and JSON, and plain groups the tasks of each window by status. `--help` already says "after filtering and sorting" and needs no change.
4. src/test/cli-list-window.test.ts (CLI output only): two tests assert that plain task windows join into the complete grouped output, which no longer holds. Replace those assertions: for the default order and each `--sort` value, the windows reached through the printed `Next` commands list exactly the task IDs `--json` returns for the same flags; each window prints its tasks under status headings; the range, total and `Next` skip agree with JSON `total` and `nextSkip`; the issue's reproduction (ordinals 10, 20, 30, 40, the first In Progress, `--sort ordinal --max-count 2`) lists TASK-1 and TASK-2; `--limit` output is unchanged.
5. Verify: `bun test --timeout=10000` on src/test/cli-list-window.test.ts, src/test/list-window.test.ts and the CLI task list suites that read plain or JSON lists; `bunx tsc --noEmit`; `bun run check .`.

Out of scope, to report: plain `search` still cuts after grouping results by type while `search --json` cuts in relevance order.

6. src/test/cli-pipe-output.test.ts: its windowed case named a task that only the old status-grouped window contained; name the last task each case lists instead.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch tasks/back-721-plain-list-window (bottom of the local gh stack; BACK-722 stacks on it).

- src/cli.ts, `runTaskList`: plain output now gives `printListWindow` the list `narrowForDisplay` returns (sorted, narrowed to the parent, shortened by `--limit`), which is the list the JSON branch windows. The print callback groups the tasks of the window by status through `printTasksGroupedByStatus`, as it already did for `--limit`. The pre-grouped `printedTasks` list is deleted. `groupTasksByStatus` now has one caller and stays a separate pure function because BACK-722 plans to reuse it for other surfaces.
- CLI-INSTRUCTIONS.md, "Paging long lists": states that `task list` takes the window from the sorted list in plain and JSON and that plain groups only the window's tasks by status. The advice to read all windows of a list in one output mode now names `search` only, where it still applies.
- src/test/cli-list-window.test.ts: a second project holds the issue's four tasks (ordinals 10 to 40, the first In Progress) with two priorities so the priority order differs from the ID order. New tests, through CLI output only: `--sort ordinal --max-count 2` prints exactly what `--limit 2` prints plus the footer (TASK-2 under To Do, TASK-1 under In Progress); for the default order and for `--sort priority`, `id` and `ordinal`, each window lists the IDs `--json` returns for the same flags, and the shown range, total and `Next` skip equal JSON `total` and `nextSkip`. Two existing assertions joined plain task windows into the complete grouped output; they now check that the windows follow the sorted list and cover the same tasks. The CLI helpers are created per project by `projectCli`, so each describe block runs against the directory it creates and no module-level directory is shared.
- src/test/cli-pipe-output.test.ts: its 20-task window was expected to contain TASK-24, which was true only in the status-grouped order; each case now names the last task it lists (TASK-20 for the window).
- Run against the origin/main CLI, 5 tests in cli-list-window.test.ts fail (the reproduction, the paging test, and the default, `id` and `ordinal` comparisons). The `--sort priority` comparison passes on both versions because that flat list never had the defect.

Verification, in two projects created for this task alone and run against an export of origin/main (f6657a16), an installed 1.53.0 build, and this branch. Under src the origin/main export and this branch differ only in the three files this task changes.
- Issue reproduction (first project, created with the issue's commands): from origin/main and from 1.53.0, `task list --plain --sort ordinal --max-count 2` prints TASK-2 and TASK-3 under To Do; from this branch it prints TASK-2 under To Do and TASK-1 under In Progress, then `Showing 1-2 of 4 items. Next: backlog task list --plain --sort ordinal --max-count 2 --skip 2`. `--json` with the same flags returns TASK-1, TASK-2, total 4, nextSkip 2 from all three.
- Same tasks as JSON (second project, created the same way, with high priority on TASK-1 and medium on TASK-3): for no `--sort` and for `priority`, `id` and `ordinal`, at `--max-count 2` with `--skip 0` and `--skip 2`, plain from this branch lists the IDs JSON returns, and its range, total and `Next` skip equal JSON `total` and `nextSkip`. From origin/main, plain lists different IDs for no `--sort`, `id` and `ordinal`.
- Unchanged output: 48 variants print byte-identical output from origin/main, from 1.53.0 and from this branch, on both projects. They are `--json` for every sort with `--limit`, `--max-count` and `--skip`, and `--plain` for every sort uncut, with `--limit` and with `--count`. Plain output cut by `--max-count` or `--skip`, which this task changes, is not among them.
- `bun test --timeout=10000` per file: list-window 8 pass, cli-list-window 17 pass, cli-pipe-output 2 pass, cli-task-list 20 pass, cli-task-list-ordinal-sort 2 pass, cli-json-output 16 pass, cli-plain-output 5 pass, cli-parent-filter 8 pass, cli-status-filtering 9 pass, cli-exclude-status-filtering 5 pass, cli-guidance 16 pass, readiness-surface-agreement 5 pass, cli-json-watch 8 pass, cli-auto-plain-non-tty 4 pass, cli-milestone-filter 7 pass, cli-task-type 5 pass, cli-task-project 6 pass. No failures.
- `bunx tsc --noEmit` exits 0. `bun run check .` reports no issues in 431 files.

Left for a decision, not changed: plain `search` still cuts after grouping results by type while `search --json` cuts in relevance order, so the two formats can select different results for the same window. CLI-INSTRUCTIONS.md documents that difference.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task list --plain` now applies `--max-count` and `--skip` to the sorted list, the same list `--json` windows, and groups only the selected tasks by status for printing, as `--limit` already did. Before, the window was taken from the status-grouped print order, so the same flags selected different tasks in plain and JSON output (issue #1059). With four tasks at ordinals 10 to 40 and the first one In Progress, `--plain --sort ordinal --max-count 2` listed TASK-2 and TASK-3 while `--json` returned TASK-1 and TASK-2. It now lists TASK-1 and TASK-2, and the shown range, total and `Next` command agree with JSON `total` and `nextSkip`.

The change is in `runTaskList` (src/cli.ts): the plain branch passes the sorted list to the window, and the print callback groups the tasks it receives. JSON output, `--limit`, `--count` and the flat `--sort priority` list are unchanged. CLI-INSTRUCTIONS.md describes the new behavior.

Behavior change: each plain window of `task list` prints its own status headings, so successive windows no longer concatenate into the full grouped output, which BACK-687 had chosen. Not changed: plain `search` still windows its type-grouped order while `search --json` windows by relevance.

Verification: new CLI tests in src/test/cli-list-window.test.ts cover the reproduction, the comparison with `--limit`, and the comparison with `--json` for the default order and each `--sort` value; five tests in that file fail against the previous CLI. 17 scoped test files pass, 48 list variants print byte-identical output from origin/main, from 1.53.0 and from this branch, and `bunx tsc --noEmit` and `bun run check .` pass.
<!-- SECTION:FINAL_SUMMARY:END -->
