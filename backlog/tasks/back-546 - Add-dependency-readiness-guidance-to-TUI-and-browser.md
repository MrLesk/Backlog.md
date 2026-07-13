---
id: BACK-546
title: Add dependency readiness guidance to TUI and browser
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-07-13 16:06'
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
- [ ] #1 Plan review defines ready and blocked semantics for partial graphs, cycles, missing dependencies, and dependencies in other statuses
- [ ] #2 The TUI and browser present consistent, non-mutating readiness and blocked guidance
- [ ] #3 Existing ordinal order remains authoritative unless Alex explicitly approves an ordering change
- [ ] #4 Cycles and ambiguous dependency data are represented honestly and fail safely
- [ ] #5 Users can identify which dependencies block a task
- [ ] #6 Automated tests and rendered QA cover ready, blocked, cross-status, missing, and cyclic examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
