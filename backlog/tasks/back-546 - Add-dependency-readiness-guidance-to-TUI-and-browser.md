---
id: BACK-546
title: Add dependency readiness guidance to TUI and browser
status: In Progress
assignee:
  - '@cottrell'
created_date: '2026-07-13 16:06'
updated_date: '2026-07-24 07:43'
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
Validated with bun test src/test/readiness.test.ts, bunx tsc --noEmit, and bun run check .
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added shared task readiness resolution (getTaskReadiness), --ready flag to task list CLI/MCP, and Web UI readiness guidance badge. Verified via tests and typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->
