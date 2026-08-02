---
id: BACK-564
title: Match milestone ID queries in task list milestone filtering
status: Done
assignee:
  - '@alexs-agent'
created_date: '2026-08-02 18:01'
updated_date: '2026-08-02 18:27'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/819'
modified_files:
  - src/utils/milestone-filter.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/milestone-filter.test.ts
  - src/test/cli-milestone-filter.test.ts
  - src/test/mcp-drafts.test.ts
priority: medium
type: bug
ordinal: 207000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #819 reports that task list milestone filtering accepts milestone titles but fails for numeric or canonical milestone IDs, even when task creation has just stored the canonical ID. Restore the documented Milestone ID or title contract consistently across canonical CLI listing, the interactive task list, and the legacy MCP adapter without changing unrelated milestone behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Numeric and canonical milestone ID queries, including case variants, list only tasks assigned to that milestone
- [x] #2 Milestone title filtering continues to support exact, partial, and typo queries, including titles whose punctuation is semantically significant to interactive matching
- [x] #3 Plain and JSON CLI task-list output and the interactive task list resolve milestone IDs and punctuated titles consistently
- [x] #4 MCP task_list resolves milestone IDs consistently for active tasks and for the Draft status path
- [x] #5 Queries that match no configured milestone return no tasks rather than unrelated tasks
- [x] #6 Regression tests cover shared matching, CLI output, interactive filtering, and MCP active-task and draft paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Use the shared milestone filter resolver to resolve the query and stored candidate values into the same title vocabulary before closest matching; reuse that one path in Core task queries and MCP draft listing.

2. Seed the interactive task list with the matched raw milestone title, because its in-memory matcher compares lowercased titles without punctuation normalization. Keep the plain/JSON Core path and the MCP active/draft paths behaviorally aligned.

3. Extend regression coverage for numeric, canonical, and case-varied milestone IDs; punctuated exact/partial titles; unmatched queries; CLI plain and JSON output; interactive filtering; and MCP active and Draft status paths.

4. Inspect the current-main diff for scope and simplicity, exercise the issue #819 CLI round trip and MCP adapter explicitly, then run typecheck, Biome, build, and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research confirmed one value-vocabulary defect across the affected surfaces: stored milestone values are resolved to titles, but the query was previously left as an ID before closest matching. The interactive task list then adds a second representation boundary: it compares raw lowercased titles, while the CLI had seeded it with punctuation-normalized text. Resolving to the matched stored title once addresses both ID aliases and punctuated titles without broadening behavior. The browser picker is outside this free-text filtering path.

Implemented one shared resolve-to-title path and reused it for Core queries, the interactive CLI seed, and MCP draft filtering. Added plain and JSON CLI assertions plus unit/interactive and MCP active/Draft coverage.

Verification evidence: issue #819 round trip passed in a clean scratch project for 0, m-0, M-0, punctuated title, title typo, JSON output, and an unmatched query. The focused milestone/CLI/MCP suite passed 22 tests with 122 assertions. A controlled mutation that skipped query resolution produced four expected regression failures across unit, CLI, interactive, and MCP paths; restoring the resolver returned the suite to green. bunx tsc --noEmit, bun run check ., and bun run build passed. The full bun test suite passed 1,869 tests with 5 documented opt-in interactive skips and 0 failures.

Automatic Codex review edge cases addressed with regression coverage: milestone IDs take precedence over colliding titles; recognized IDs short-circuit fuzzy matching when no task is assigned; archived milestone IDs resolve in the interactive viewer without appearing as active picker options; and the subprocess-heavy CLI ID matrix has an explicit 10-second timeout. Focused tests, typecheck, Biome, build, and the full 209-file suite are green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Resolved milestone filter queries and stored values through one shared title vocabulary, so numeric/canonical IDs and punctuated titles behave consistently in plain/JSON CLI output, the interactive task list, and MCP active/Draft listing. Verified with the issue #819 CLI round trip, mutation-backed focused regressions, typecheck, Biome, build, and 1,869 passing full-suite tests.

Follow-up review fixes preserve deterministic ID semantics, cover archived interactive filtering, and keep the CLI regression reliable on slower runners. Final local verification: 1872 passed, 5 opt-in interactive tests skipped, 0 failed.
<!-- SECTION:FINAL_SUMMARY:END -->
