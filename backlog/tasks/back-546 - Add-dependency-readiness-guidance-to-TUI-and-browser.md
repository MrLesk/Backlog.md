---
id: BACK-546
title: Add dependency readiness guidance to TUI and browser
status: Done
assignee:
  - '@codex'
created_date: '2026-07-13 16:06'
updated_date: '2026-08-02 20:31'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebuild dependency-readiness changes from current main without Kanban ready-filter controls. 2. Verify readiness semantics across CLI, MCP, browser, and interactive TUI. 3. Finalize the task and update the existing draft PR to contain only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebuilt the split from current main without the Kanban ready-filter controls. Verified the CLI, MCP, browser, and interactive TUI readiness behavior with rendered and integration tests; full bun test, bunx tsc --noEmit, bun run check ., and bun run build all pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added canonical dependency-readiness guidance across CLI, MCP parity, browser, and interactive TUI without changing ordinal ordering. Verified by full bun test, TypeScript, Biome, and production build.
<!-- SECTION:FINAL_SUMMARY:END -->
