---
id: BACK-530
title: Support user-defined priority values
status: Done
assignee:
  - '@codex'
created_date: '2026-07-09 06:18'
updated_date: '2026-07-09 21:02'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/732'
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #732 requests configurable task priority values beyond the built-in high/medium/low set, for example Very High, High, Medium, Low, Very Low. Backlog.md should allow a project to define its priority list in configuration while preserving the current default priorities for existing projects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Projects can configure an ordered list of task priorities, and existing projects without configuration continue to use high, medium, low.
- [x] #2 CLI create, edit, list, search, help text, and task wizard accept and display configured priority values case-insensitively.
- [x] #3 MCP task schemas and handlers expose and validate configured priority values instead of a fixed high/medium/low enum.
- [x] #4 Web task filters and task editing surfaces use the configured priority list and reject unsupported priority filters consistently.
- [x] #5 Priority parsing, sorting, and statistics handle configured priority values without dropping custom priorities.
- [x] #6 Regression tests cover a custom priority list with values beyond high/medium/low.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fix canonical Bash completion generation so configured multi-word priorities remain single candidates on Bash 3.2+, regenerate committed completion artifacts through the existing script, and add regression coverage.
2. Centralize Web priority query canonicalization against configured priorities for Board and All Tasks, clear unsupported URL values using existing filter-state patterns, and test mixed-case valid plus unsupported values.
3. Make statistics represent configured priority "None" separately from missing priority without changing MCP guidance, and add collision regressions.
4. Run focused tests, type-check, Biome, build, and targeted simplification; update task notes/final summary and return to Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented custom priority configuration across config parsing, core validation, CLI/help/search/list/edit flows, MCP schemas/handlers, server API filters, statistics, TUI/web filters, display, and sorting. Parser now preserves arbitrary stored priorities, while write/filter paths validate against the configured ordered list.

Validation passed: bunx tsc --noEmit; bun run check .; bun run build; bun test src/test/search-command-query.test.ts src/test/cli-priority-filtering.test.ts; bun test (1453 pass, 2 skip, 0 fail).

PR #743 review follow-up started from 1dea690: addressing completion quoting, Web URL canonicalization, and configured priority None statistics collision in a dedicated clean worktree.

PR #743 review follow-up completed. Bash completion now preserves newline-delimited multi-word priorities as single candidates with Bash 3.2-compatible syntax in both committed and embedded scripts. Board and All Tasks canonicalize configured priority URL values case-insensitively after config loads and clear unsupported values without invalid searches. Statistics now stores missing priorities in noPriorityCount, leaving configured None and other custom values distinct.

Validation: bun test src/commands/completion.test.ts src/test/statistics.test.ts src/test/web-board-filters.test.tsx src/test/web-task-list-labels-menu.test.tsx (32 pass, 0 fail); bunx tsc --noEmit; bun run check .; bun run build; compiled-binary Bash completion smoke test on Bash 3.2.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed configurable priority support and closed the PR #743 edge cases: multi-word Bash completions remain atomic on Bash 3.2+, Board and All Tasks normalize or clear priority URL filters consistently, and statistics distinguish configured None from tasks with no priority. Focused regressions, type checking, Biome, the production build, and the compiled completion smoke test all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
