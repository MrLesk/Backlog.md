---
id: BACK-532
title: Add exclude-status filtering to task list and search
status: Done
assignee:
  - '@codex'
created_date: '2026-07-09 06:58'
updated_date: '2026-07-09 07:17'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/690'
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #690 bundles board sorting and status filtering requests. The sorting side is already covered by existing board ordering plus the narrower #694 board menu work, so this task implements the remaining narrow slice: allow users to exclude one or more configured statuses from task list/search views without introducing a broader filter framework.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI task list supports excluding one or more configured statuses, case-insensitively, and can combine exclusion with existing filters.
- [x] #2 CLI search and task search plumbing support excluding one or more configured statuses for task results.
- [x] #3 Web All Tasks supports excluding statuses from the visible task set and persists the exclusion in URL query parameters.
- [x] #4 Invalid excluded statuses are rejected consistently with existing configured-status validation.
- [x] #5 Regression tests cover exclude-status filtering for CLI/search and Web All Tasks.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add excludeStatus to shared task/search filter types and apply it in ContentStore, SearchService, and the in-memory task search helper.
2. Expose exclude-status in CLI task list and search with configured-status validation and help text.
3. Expose excludeStatus through server API/search client and MCP task list/search schemas/handlers.
4. Add an Exclude status control to Web All Tasks that persists in URL params and combines with existing filters.
5. Add focused regression tests for CLI/search, server/search service, MCP, and Web All Tasks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scoped #690 to the accepted narrow filter slice. Sorting is already covered by existing done-column behavior and the narrower #694 board column menu work; this task implements status exclusion without a broad multi-filter rewrite.

Reproduced the original gap with 'bun run cli task list --exclude-status Done --plain', which failed as an unknown option before implementation. Added excludeStatus across shared task filters, CLI task list/search, server APIs, MCP task list/search, and Web All Tasks URL/search handling. Updated MCP workflow guidance for the new public filter. Validation passed: bunx tsc --noEmit; bun run check .; bun run build; bun test (1454 pass, 2 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented narrow #690 exclude-status filtering across CLI, server/search plumbing, MCP, and Web All Tasks, with configured-status validation and regression coverage. Verified with TypeScript, Biome, build, and the full Bun test suite.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
