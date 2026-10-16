---
id: BACK-564
title: Match milestone ID queries in task list milestone filtering
status: Done
assignee:
  - '@alexs-agent'
created_date: '2026-08-02 18:01'
updated_date: '2026-08-02 19:13'
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
1. Build one shared milestone filter resolver that preserves exact configured ID identity and canonical alias precedence, while using punctuation-tolerant fuzzy matching only for unresolved title queries.

2. Reuse the shared identity-aware matcher in Core task queries, MCP Draft filtering, the interactive task viewer, and the board; keep active picker options separate from archived alias resolution.

3. Cover numeric/canonical/case-varied IDs, padded aliases, colliding/reused titles, punctuated/partial/typo/numeric titles, Unicode and symbol-only titles, unmatched queries, plain/JSON CLI output, interactive filtering, and MCP active/Draft paths.

4. Exercise the issue #819 CLI round trip and MCP adapter explicitly, then run typecheck, Biome, build, the full test suite, and exact-head CI/Codex review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research confirmed one value-vocabulary defect across the affected surfaces: stored milestone values are resolved to titles, but the query was previously left as an ID before closest matching. The interactive task list then adds a second representation boundary: it compares raw lowercased titles, while the CLI had seeded it with punctuation-normalized text. Resolving to the matched stored title once addresses both ID aliases and punctuated titles without broadening behavior. The browser picker is outside this free-text filtering path.

Implemented one shared resolve-to-title path and reused it for Core queries, the interactive CLI seed, and MCP draft filtering. Added plain and JSON CLI assertions plus unit/interactive and MCP active/Draft coverage.

Verification evidence: issue #819 round trip passed in a clean scratch project for 0, m-0, M-0, punctuated title, title typo, JSON output, and an unmatched query. The focused milestone/CLI/MCP suite passed 22 tests with 122 assertions. A controlled mutation that skipped query resolution produced four expected regression failures across unit, CLI, interactive, and MCP paths; restoring the resolver returned the suite to green. bunx tsc --noEmit, bun run check ., and bun run build passed. The full bun test suite passed 1,869 tests with 5 documented opt-in interactive skips and 0 failures.

Automatic Codex review edge cases addressed with regression coverage: milestone IDs take precedence over colliding titles; recognized IDs short-circuit fuzzy matching when no task is assigned; archived milestone IDs resolve in the interactive viewer without appearing as active picker options; and the subprocess-heavy CLI ID matrix has an explicit 10-second timeout. Focused tests, typecheck, Biome, build, and the full 209-file suite are green.

Second Codex review identified that ASCII-only normalization collapsed non-ASCII-only milestone titles. Added a red/green regression covering distinct CJK milestones and unassigned tasks, then changed the shared normalizer to preserve Unicode letters and numbers across Core and MCP filtering.

Consolidated final review fixes around a shared identity-aware matcher: exact configured ID queries compare canonical milestone identities (including canonical-over-padded alias precedence and reused active/archived titles), while only unresolved queries use fuzzy title matching. Symbol-only titles retain a non-empty fallback key. Core, MCP active/Draft, task-viewer, board, plain/JSON CLI, and interactive matching now reuse the shared resolver/matcher path.

Final Codex follow-up: exact configured titles now take literal punctuation-preserving precedence before normalized fuzzy matching, and milestone resolution uses the full task or draft candidate set before intersecting status/search/type/assignee/label filters across Core, MCP, task viewer, and board.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Resolved milestone filter queries and stored values through one shared title vocabulary, so numeric/canonical IDs and punctuated titles behave consistently in plain/JSON CLI output, the interactive task list, and MCP active/Draft listing. Verified with the issue #819 CLI round trip, mutation-backed focused regressions, typecheck, Biome, build, and 1,869 passing full-suite tests.

Follow-up review fixes preserve deterministic ID semantics, cover archived interactive filtering, and keep the CLI regression reliable on slower runners. Final local verification: 1872 passed, 5 opt-in interactive tests skipped, 0 failed.

Unicode milestone identities are now preserved during filtering, preventing CJK-only titles from collapsing into the same empty comparison key.

Final consolidated verification: 57 focused integration tests passed; bunx tsc --noEmit, Biome, and build passed; the exact-working-tree full suite passed 1,878 tests with 5 documented opt-in interactive skips and 0 failures.

Final exact-tree verification after the last matcher-order fixes: 1,880 tests passed, 5 documented opt-in interactive tests skipped, and 0 failed across 209 files.
<!-- SECTION:FINAL_SUMMARY:END -->
