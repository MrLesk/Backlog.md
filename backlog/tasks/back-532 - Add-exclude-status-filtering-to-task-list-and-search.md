---
id: BACK-532
title: Add exclude-status filtering to task list and search
status: Done
assignee:
  - '@codex'
created_date: '2026-07-09 06:58'
updated_date: '2026-07-09 20:55'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/690'
modified_files:
  - src/cli.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/core/search-service.ts
  - src/file-system/operations.ts
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-creation.md
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/server/index.ts
  - src/test/cli-exclude-status-filtering.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/search-service.test.ts
  - src/test/server-search-endpoint.test.ts
  - src/test/unified-view-filters.test.ts
  - src/test/web-task-list-labels-menu.test.tsx
  - src/types/index.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/unified-view.ts
  - src/utils/status.ts
  - src/utils/task-search.ts
  - src/web/components/LabelFilterDropdown.tsx
  - src/web/components/TaskList.tsx
  - src/web/lib/api.ts
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
1. Preserve shared exclude-status filtering for CLI, server, Web, TUI, and core search plumbing. 2. Remove the PR-added MCP excludeStatus schemas, handler branches, regression test, and MCP workflow guidance. 3. Add canonical CLI --exclude-status guidance to the shipped task-creation workflow and verify focused plus full project checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scoped #690 to the accepted narrow filter slice. Sorting is already covered by existing done-column behavior and the narrower #694 board column menu work; this task implements status exclusion without a broad multi-filter rewrite.

Reproduced the original gap with 'bun run cli task list --exclude-status Done --plain', which failed as an unknown option before implementation. Added excludeStatus across shared task filters, CLI task list/search, server APIs, MCP task list/search, and Web All Tasks URL/search handling. Updated MCP workflow guidance for the new public filter. Validation passed: bunx tsc --noEmit; bun run check .; bun run build; bun test (1454 pass, 2 skip, 0 fail).

PR #745 review follow-up: fixed interactive search so --exclude-status seeds the TUI from filtered task results instead of all tasks, and carried excludeStatus through unified task-list/kanban filter state so live search updates and view switches cannot reintroduce excluded statuses. Added unified-view regression coverage for preserving and applying excluded statuses. Validation passed: bun test src/test/unified-view-filters.test.ts src/test/cli-exclude-status-filtering.test.ts; bunx tsc --noEmit; bun run check .; bun run build.

PR #745 second review follow-up: carried excludeStatus through board shared filters and board filter-change emissions, included exclude-only state in the task-viewer initial filter application, and stopped prefiltering task-list interactive loader results so the TUI receives the full source collection and applies excludeStatus as filter state. Validation passed: bun test src/test/unified-view-filters.test.ts src/test/cli-exclude-status-filtering.test.ts; bun test src/test/board-ui.test.ts src/test/unified-view-filters.test.ts; bunx tsc --noEmit; bun run check .; bun run build.

PR #745 third review follow-up: seeded excludeStatus into the interactive search runUnifiedView filter state so live task watcher updates continue honoring --exclude-status after the initial filtered task list is loaded. Validation passed: bun test src/test/cli-exclude-status-filtering.test.ts src/test/unified-view-filters.test.ts; bunx tsc --noEmit; bun run check .; bun run build.

PR #745 fourth review follow-up: routed board filter-change state through mergeUnifiedViewFilters so emitted excludeStatus values update unified task-list/kanban state instead of being forced to the previous value. Added regression coverage for explicit excludeStatus updates. Validation passed: bun test src/test/unified-view-filters.test.ts src/test/cli-exclude-status-filtering.test.ts; bunx tsc --noEmit; bun run check .; git diff --check.

PR #745 fifth review follow-up: kept interactive search source tasks unfiltered by the clearable exclude-status filter while still seeding excludeStatus into TUI filter state, and made status canonicalization fall back to default statuses when config statuses are empty. Added regression coverage for empty configured statuses. Validation passed: bun test src/test/cli-exclude-status-filtering.test.ts src/test/unified-view-filters.test.ts; bunx tsc --noEmit; bun run check .; git diff --check.

PR #745 sixth review follow-up: kept hidden exclude-status filters from blocking Kanban move mode, while retaining them as active display filters, and made Web status loading/menu options fall back to default statuses when configured statuses are empty. Added regressions for board move blocking, /api/statuses fallback, and the exclude-status menu fallback. Validation passed: bun test src/test/board-ui.test.ts src/test/web-task-list-labels-menu.test.tsx src/test/server-search-endpoint.test.ts src/test/cli-exclude-status-filtering.test.ts src/test/unified-view-filters.test.ts; bunx tsc --noEmit; bun run check .; git diff --check.

PR #745 specification correction: keep the shared exclude-status implementation for CLI, server, Web, TUI, and core search behavior, but remove the net-new MCP tool surface and MCP workflow guidance. The shipped CLI task-creation guide is now the canonical public workflow documentation for --exclude-status.

PR #745 specification-correction validation: focused coverage passed with 185 tests and 0 failures; bunx tsc --noEmit passed; bun run check . passed; bun run build passed; full bun test passed on the exact staged tree in a disposable worktree with 1461 pass, 2 skip, and 0 fail. The disposable run was used after an initial live-worktree run triggered a transient worktree cleanup race; the branch ref remained intact and the narrow patch was restored and reverified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Kept exclude-status filtering CLI-first across shared core, server, Web, TUI, and search behavior; removed the net-new MCP tool surface and MCP workflow guidance; and documented canonical --exclude-status CLI usage. Verified with focused tests, TypeScript, Biome, build, and the full Bun test suite.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
