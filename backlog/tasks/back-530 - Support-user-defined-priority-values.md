---
id: BACK-530
title: Support user-defined priority values
status: Done
assignee:
  - '@codex'
created_date: '2026-07-09 06:18'
updated_date: '2026-07-09 06:48'
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
1. Add a shared priority configuration helper that normalizes configured values, preserves the default high/medium/low list, formats labels, and provides ordering/rank checks.
2. Extend Backlog config load/save/types/help to support a priorities array without requiring existing projects to change.
3. Replace fixed priority validation in core, parser, CLI, MCP schemas, API filters, completions, and task wizard with config-aware normalization.
4. Pass configured priorities through web and TUI list/board/edit surfaces so filters, display, and sort-by-priority use the same ordered list.
5. Add regression tests for custom configured priorities across config parsing, CLI create/list/search, sorting, MCP schema generation, API filters, and web filters.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented custom priority configuration across config parsing, core validation, CLI/help/search/list/edit flows, MCP schemas/handlers, server API filters, statistics, TUI/web filters, display, and sorting. Parser now preserves arbitrary stored priorities, while write/filter paths validate against the configured ordered list.

Validation passed: bunx tsc --noEmit; bun run check .; bun run build; bun test src/test/search-command-query.test.ts src/test/cli-priority-filtering.test.ts; bun test (1453 pass, 2 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added configurable ordered priority values with defaults preserved for existing projects. CLI, MCP, server API, web/TUI surfaces, completions, sorting, statistics, parsing, docs, and regression tests now use the configured priority list and accept values case-insensitively.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
