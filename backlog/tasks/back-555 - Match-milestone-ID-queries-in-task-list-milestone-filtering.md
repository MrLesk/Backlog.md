---
id: BACK-555
title: Match milestone ID queries in task list milestone filtering
status: In Progress
assignee:
  - '@therealkevinard'
created_date: '2026-07-27 20:27'
updated_date: '2026-07-27 21:00'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/819'
  - .local/triage/milestone-parse.md
priority: medium
type: bug
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `--milestone` filter on task listing only matches milestones by title. Querying by milestone ID returns no results, including the exact ID string that the write path canonicalized and stored on the task.

`backlog task list --help` documents the flag as "Milestone ID or title - Closest case-insensitive match". The write path honors that contract (`task create -m 0` resolves and stores `milestone: m-0`), but the read path cannot find what the write path just wrote, so the two surfaces disagree about what a milestone reference is.

Reported upstream as MrLesk/Backlog.md#819.

Cause: the milestone query value is passed raw into the fuzzy matcher while the candidate list is resolved to titles, so the ID-to-title resolver only ever runs on one side of the comparison. The same resolve/match/filter block is duplicated across the CLI list path, the interactive TUI path, and the MCP draft list path, and all three share the asymmetry. The resolver itself already supports ID aliases and is unit tested for it; it is simply never applied to the query.

The browser is not affected: it filters from a milestone picker rather than free text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Listing tasks filtered by a numeric milestone ID (for example 0) returns the tasks assigned to that milestone
- [x] #2 Listing tasks filtered by the stored milestone ID form (for example m-0) returns the same tasks, case-insensitively
- [x] #3 Filtering by milestone title continues to work, including partial and typo inputs that rely on closest-match behavior
- [x] #4 A milestone query that matches no known milestone returns no tasks rather than unrelated ones
- [x] #5 The interactive TUI task list resolves milestone ID queries the same way as the plain and JSON output paths
- [x] #6 MCP task listing and draft listing resolve milestone ID queries the same way as the CLI
- [x] #7 Tests cover ID-form milestone queries at both the unit level and the CLI integration level
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Resolve the milestone query through the ID-to-title resolver before the closest-match step, so ID and title queries enter matching as the same kind of value. Apply at the CLI/JSON path (core/backlog.ts) and the MCP draft list path (mcp/tools/tasks/handlers.ts).

2. Fix the filter-value vocabulary mismatch feeding the TUI. cli.ts currently hands the interactive view a normalized value (punctuation collapsed to spaces) while the TUI matchers compare raw lowercased titles, so the two only agree when a milestone title has no punctuation. Hand the TUI a resolved milestone title instead.

3. Extract one shared resolve-then-match helper in utils/milestone-filter.ts for the sites that duplicate the block, keeping the no-milestone sentinel short-circuit intact.

4. Tests: unit coverage for ID-form queries (numeric, m-N, mixed case) and for a punctuated milestone title through the TUI value path; CLI integration coverage asserting ID-form queries list the expected tasks and that unknown queries still return nothing.

5. Verify: bunx tsc --noEmit, bun run check ., and bun test.

Notes from research: the closest-match matcher and the TUI matchers use different comparison rules (normalized vs raw lowercase). The no-milestone sentinel is handled only in the task-search path and must keep short-circuiting before any resolution. The browser is unaffected because it filters from a picker rather than free text.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Resolved the milestone query through the ID-to-title resolver before the closest-match step in the CLI/JSON path (core/backlog.ts) and the MCP draft list path (mcp/tools/tasks/handlers.ts).

Added resolveMilestoneFilterTitle in utils/milestone-filter.ts, which resolves a query to the stored milestone title, and used it in cli.ts to seed the interactive view. Research showed the interactive matchers compare raw lowercased titles while cli.ts was emitting the normalized form, so ID queries and any milestone title containing punctuation both failed there. Handing the interactive view a title fixes both; the two defects share one line and are not separable.

Did not collapse the five duplicated milestone matchers; recorded in .local/triage/collateral-findings.md as follow-up along with the dangling-milestone-on-write observation.

Verification: bunx tsc --noEmit clean, bun run check . clean, full bun test 1786 pass / 4 skip / 0 fail. Upstream repro from issue 819 confirmed fixed in a scratch project (-m 0, -m m-0, -m M-0 all list the task).

Added regression coverage: CLI integration tests for numeric, m-N, and upper-case ID queries plus an unmatched-query case; an MCP test asserting task_list and draft_list both resolve ID forms; and a unit test that runs the value cli.ts seeds through the interactive view matcher (applyTaskFilters) to guard against reintroducing the normalized-value mismatch.

Confirmed the new tests are non-vacuous: reverting only the two call sites while keeping helper and tests in place fails the CLI ID test and the MCP milestone test, and they pass again once restored.

AC5 evidence note: verified through the interactive view matcher in the test runner rather than a live TUI session, since the matcher is the component the CLI value feeds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Milestone filters now accept milestone IDs, not just titles.

The query was passed raw into closest-match while candidate values were resolved to titles, so the ID-to-title resolver only ever ran on one side of the comparison and an exact stored ID such as m-0 matched nothing. The query is now resolved before matching in the CLI/JSON path and the MCP draft list path. A new resolveMilestoneFilterTitle helper resolves a query to the stored milestone title and seeds the interactive view, which compares raw titles rather than the normalized form the CLI was previously handing it; that also fixes milestone titles containing punctuation, which could not be separated from the ID fix because both are the same value-vocabulary defect.

Verified with bunx tsc --noEmit, bun run check ., and the full bun test suite (1788 pass, 4 skip, 0 fail), plus the upstream issue 819 repro confirmed fixed in a clean project. New tests fail against the unfixed call sites and pass with them.
<!-- SECTION:FINAL_SUMMARY:END -->
