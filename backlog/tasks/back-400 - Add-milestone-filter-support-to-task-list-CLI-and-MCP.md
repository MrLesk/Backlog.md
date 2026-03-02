---
id: BACK-400
title: Add milestone filter support to task list (CLI and MCP)
status: Done
assignee:
  - '@codex'
created_date: '2026-03-01 20:26'
updated_date: '2026-03-01 20:43'
labels:
  - cli
  - mcp
  - enhancement
dependencies: []
references:
  - /Users/alex/projects/Backlog.md/src/cli.ts
  - /Users/alex/projects/Backlog.md/src/core/backlog.ts
  - /Users/alex/projects/Backlog.md/src/types/index.ts
  - /Users/alex/projects/Backlog.md/src/mcp/tools/tasks/schemas.ts
  - /Users/alex/projects/Backlog.md/src/mcp/tools/tasks/handlers.ts
  - 'https://github.com/MrLesk/Backlog.md/issues/546'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable users and MCP clients to filter tasks by milestone in listing workflows. Milestones are already stored on tasks and listed by milestone tooling, but task-list filters currently cannot query by milestone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI `task list` supports `-m, --milestone <milestone>` and applies milestone filtering alongside existing filters.
- [x] #2 Core task filtering supports milestone matching as a case-insensitive exact match, consistent with existing status/priority filtering style.
- [x] #3 MCP `task_list` accepts a `milestone` parameter in its input schema without validation errors.
- [x] #4 MCP `task_list` applies the milestone filter and returns only tasks whose milestone matches the requested value.
- [x] #5 Automated tests cover CLI and MCP milestone filter behavior, including case-insensitive matching and combination with at least one existing filter.
- [x] #6 Existing task listing behavior is unchanged when no milestone filter is provided.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend task list filter contract and core filtering.
- Update `TaskListFilter` in `src/types/index.ts` to include optional `milestone`.
- Add milestone filtering in `Core.applyTaskFilters` (`src/core/backlog.ts`) as a case-insensitive exact match, aligned with current status/priority filter semantics.
- Keep behavior unchanged when `milestone` is not provided.

2. Wire CLI `task list` milestone filter.
- Add `-m, --milestone <milestone>` option to `task list` in `src/cli.ts`.
- Include `options.milestone` in `baseFilters` passed to `core.queryTasks`.
- Include milestone in active-filter display text and `runUnifiedView` filter payload so TUI header/filter state reflects the new flag.
- Preserve existing parent/sort/error behavior.

3. Wire MCP `task_list` milestone filter end-to-end.
- Add `milestone` to `taskListSchema` in `src/mcp/tools/tasks/schemas.ts` so the tool accepts the field.
- Extend `TaskListArgs` in `src/mcp/tools/tasks/handlers.ts` with optional `milestone`.
- Add `filters.milestone` in the non-draft `task_list` handler before calling `core.queryTasks`.
- Apply the same milestone filter in the draft branch for consistent `task_list` behavior when `status: Draft` is requested.

4. Add automated coverage for CLI and MCP milestone filtering.
- Add/extend CLI tests (likely new focused test file under `src/test/`) to verify:
  - milestone filtering returns only matching tasks,
  - matching is case-insensitive,
  - milestone filter combines correctly with an existing filter (status),
  - listing behavior remains unchanged without `--milestone`.
- Add/extend MCP tests (likely `src/test/mcp-tasks.test.ts`) to verify:
  - `task_list` accepts `milestone` without schema errors,
  - milestone filtering works and is case-insensitive,
  - milestone combines with at least one existing filter.

5. Validate and regression-check.
- Run targeted tests for changed CLI/MCP suites first.
- Run `bunx tsc --noEmit` and scoped `bun test` for changed files; run broader checks if targeted results indicate regressions.
- Confirm no output/behavior changes when milestone filter is omitted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TPM directive: treat GitHub issue #546 as authoritative scope anchor for this task.

Implementation started after TPM approval. Proceeding with focused scope: CLI task list + MCP task_list + shared core filter path; raw milestone exact match (case-insensitive), including Draft task_list path.

Implemented milestone filtering for task listing across CLI and MCP using the shared `TaskListFilter` + `Core.applyTaskFilters` path with case-insensitive exact raw milestone matching.

CLI updates: added `task list -m, --milestone <milestone>`; wired milestone into `baseFilters`, active filter display text, and unified-view filter payload.

MCP updates: `task_list` schema now accepts `milestone`; handler applies milestone filter in both regular and Draft status paths.

Added automated coverage: new `src/test/cli-milestone-filter.test.ts` and new milestone-focused MCP integration tests in `src/test/mcp-tasks.test.ts` (including Draft path).

Verification evidence: `bun test src/test/cli-milestone-filter.test.ts` (pass), `bun test src/test/mcp-tasks.test.ts` (pass), `bun test src/test/cli-parent-filter.test.ts` (pass regression), `bun test src/test/mcp-tasks-local-filter.test.ts` (pass regression), `bunx tsc --noEmit` (pass), `bun run check .` (pass after formatting).

User-perspective verification: manual CLI run shows `task list --milestone RELEASE-1 --plain` returns only Release-1 tasks; `task list -m release-1 --status "To Do" --plain` returns only matching To Do task; `task list --plain` remains unchanged. Manual MCP call verifies `task_list` accepts `milestone` and filters both regular and Draft paths.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented milestone filtering for task listing across CLI and MCP, aligned to issue #546 scope.

What changed:
- Added `milestone?: string` to `TaskListFilter` and implemented case-insensitive exact raw milestone matching in `Core.applyTaskFilters`.
- Added CLI support for `task list -m, --milestone <milestone>` and wired it through task query filters, active filter labels, and unified-view filter state.
- Extended MCP `task_list` schema to accept `milestone` and updated handler logic to apply milestone filtering in both regular task listing and Draft-status listing paths.
- Added automated test coverage:
  - New `src/test/cli-milestone-filter.test.ts` for CLI milestone filtering, case-insensitive matching, combined filter behavior, and no-filter regression behavior.
  - Extended `src/test/mcp-tasks.test.ts` with milestone filtering tests for normal and Draft task_list paths.

Verification run:
- `bun test src/test/cli-milestone-filter.test.ts`
- `bun test src/test/mcp-tasks.test.ts`
- `bun test src/test/cli-parent-filter.test.ts`
- `bun test src/test/mcp-tasks-local-filter.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`

Manual user-perspective verification:
- CLI: `task list --milestone RELEASE-1 --plain` returned only Release-1 tasks.
- CLI: `task list -m release-1 --status "To Do" --plain` returned only matching To Do task.
- CLI: `task list --plain` remained unchanged when no milestone filter was provided.
- MCP: direct tool calls confirmed `task_list` accepts `milestone` and filters in both regular and Draft paths.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
