---
id: BACK-355.04
title: 'Filtering: Add type-based filtering to task list and search'
status: Done
assignee:
  - '@codex-types-filter'
created_date: '2026-01-01 23:37'
updated_date: '2026-07-09 22:49'
labels:
  - core
  - cli
  - mcp
dependencies:
  - task-355.01
modified_files:
  - src/cli.ts
  - src/commands/help-schema.ts
  - src/completions/helper.ts
  - src/types/index.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/core/search-service.ts
  - src/file-system/operations.ts
  - src/utils/task-search.ts
  - src/utils/task-type-config.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/index.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/mcp/utils/schema-generators.ts
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/test/task-type-filtering.test.ts
  - src/test/mcp-task-type-filtering.test.ts
parent_task_id: BACK-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable filtering tasks by type in list views, search, and board views. This supports workflows where users want to see only bugs or only features.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TaskListFilter interface includes optional 'type' field
- [x] #2 CLI task list accepts --type filter flag
- [x] #3 MCP task_list tool accepts type filter parameter
- [x] #4 Search filters support type field
- [x] #5 Multiple types can be specified for OR filtering (e.g., --type bug,feature)
- [x] #6 Filter tests cover type filtering scenarios
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the shared task-type configuration resolver from BACK-355.02 so filter inputs are validated case-insensitively, preserve configured casing, and deduplicate without a second normalizer.
2. Extend TaskListFilter, SearchFilters, the Core query path, ContentStore/FileSystem filters, SearchService, and in-memory task-search helpers with OR-based task-type matching; untyped tasks do not match a configured type filter.
3. Expose CLI filtering as repeatable/comma-separated task list --type and search --task-type (search --type remains the existing result-kind selector), compose with existing filters, and document the configured input schema/help.
4. Add config-driven MCP task_list/task_search type arrays as thin adapters over the shared Core/search semantics, including the Draft path.
5. Add focused core/store/search, CLI list/search/help/custom/multiple/composition, and MCP schema/adapter tests; run targeted tests, typecheck, Biome, build, and the full suite.
6. Rebase or stack on the BACK-355.02 shared utility as required, update task evidence via the CLI, commit, push, and open a ready PR linked to #746 without merging.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented CLI-first type filtering with shared OR semantics across Core, ContentStore, FileSystem, SearchService, and the in-memory search used by interactive views. CLI task list uses repeatable/comma-separated --type; global search uses --task-type because --type already selects task/document/decision result kinds. Configured values are validated case-insensitively and returned in canonical casing. Untyped tasks do not match an explicit type filter; no synthetic untyped token was introduced.

MCP task_list and task_search are thin adapters over the shared behavior with configuration-derived schemas, including draft filtering and type-only search. Public CLI and legacy MCP guidance were updated.

Validation on the stack over PR #747: focused type integration 31 pass; full suite 1508 pass, 2 intentional interactive PTY skips, 0 fail; bunx tsc --noEmit, bun run check ., and bun run build all pass.

Final dependency integration: rebased onto corrected PR #747 head f72664c44578abe82764af593018d4310266b79a after its independent review fixes. On that exact stack, 31 focused task-type tests passed; the full suite passed 1508 with 2 documented interactive PTY skips and 0 failures; typecheck, Biome across 313 files, and build all passed.

Final scope ownership: rebased onto PR #747 head 571b3bbd7cbe224e063da57ecb5efbe4e397ae73 after its minimal-API cleanup. BACK-355.04 now owns resolveTaskTypeValues, plural task-type help schema support, and search --task-type completion, each beside a live filtering caller. On the final source tree, 30 focused tests passed with 181 assertions; bunx tsc --noEmit, Biome across 313 files, and bun run build passed. The source implementation matches the immediately prior full-suite-tested stack except for added completion coverage; that run passed 1507 tests with 2 documented interactive PTY skips and 0 failures.

PR #748 review follow-up on final main base a89045999208a374c4ef4e41d405db5ffa7f70aa: replaced default-only filter examples with configured values in help and shipped CLI guidance; completed task list --type and top-level search --task-type completion while rejecting unsupported contexts; and routed MCP enum generation through getTaskTypeValues so whitespace, case duplicates, and empty configured entries cannot diverge from CLI/core semantics. Regression coverage verifies advertised Bug/Epic commands, positive and negative completion contexts, and MCP normalization from [Bug with whitespace, Epic, lowercase duplicate bug, empty] to [Bug, Epic]. Final validation: focused 30 pass with 190 assertions; full suite 1507 pass, 2 documented interactive PTY skips, 0 fail, 5197 assertions; typecheck, Biome across 313 files, build, and compiled Bug/Epic smokes all passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added CLI-first task type filtering: repeatable/comma-separated task list --type and search --task-type with configured validation, canonical casing, OR semantics, composition with existing filters, and no implicit match for untyped tasks. Shared Core/search/store filtering supports later human-facing interfaces; MCP list/search reuse it through configuration-derived adapter schemas. Verified with direct Core/store/in-memory search, CLI/help/custom/multiple/composition, MCP/schema/draft tests, full suite, typecheck, Biome, and build.
<!-- SECTION:FINAL_SUMMARY:END -->
