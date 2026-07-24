---
id: BACK-546
title: Add dependency readiness guidance to TUI and browser
status: Done
assignee:
  - '@cottrell'
created_date: '2026-07-13 16:06'
updated_date: '2026-07-24 08:40'
labels:
  - tui
  - web
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/785'
type: enhancement
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Address the reported need to see what can be worked next without silently restoring the abandoned derived-sequence model or changing ordinal ordering by default.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plan review defines ready and blocked semantics for partial graphs, cycles, missing dependencies, and dependencies in other statuses
- [x] #2 The TUI and browser present consistent, non-mutating readiness and blocked guidance
- [x] #3 Existing ordinal order remains authoritative unless Alex explicitly approves an ordering change
- [x] #4 Cycles and ambiguous dependency data are represented honestly and fail safely
- [x] #5 Users can identify which dependencies block a task
- [x] #6 Automated tests and rendered QA cover ready, blocked, cross-status, missing, and cyclic examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented canonical dependency readiness across CLI, MCP, Web UI, and interactive TUI surfaces using shared getTaskReadiness and applyTaskFilters utilities.

Key architecture & verification details:
1. Complete Task Graph Loading: Evaluates getTaskReadiness against the full task graph (loaded via core.loadTasks with includeCompleted: true) across all surfaces (CLI, MCP, Web UI, TUI).
2. Display Candidate Isolation: Preserves existing candidate filter semantics (assignee, status, milestone, type, search, unassigned) while ensuring candidate readiness filtering uses the full graph. Tasks depending on archived/completed tasks are properly identified as unblocked/ready.
3. UI Readiness Guidance: Web UI (TaskDetailsModal) and TUI (generateDetailContent) render explicit readiness guidance badges ('✓ Ready to start', '⏳ Blocked by: ...', or 'Terminal status (...)').
4. Comprehensive Integration & UI Rendering Tests: Added unit, CLI integration, MCP handler, and DOM/TUI rendered component tests in src/test/readiness.test.tsx, src/test/cli-task-list.test.ts, src/test/mcp-tasks.test.ts, and src/test/unified-view-filters.test.ts.

Final release verification after Kanban ready-filter integration: bun test, bunx tsc --noEmit, bun run check ., and bun run build all pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented canonical dependency readiness across CLI, MCP, Web UI, and interactive TUI, including ready-only Kanban controls. Verified with rendered UI and integration tests, full bun test, TypeScript checking, Biome, and production build.
<!-- SECTION:FINAL_SUMMARY:END -->
