---
id: BACK-573
title: Clear shared loading ownership after terminal browser initialization errors
status: To Do
assignee: []
created_date: '2026-08-03 21:28'
labels: []
dependencies: []
type: bug
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow up on BACK-571. After a terminal shared browser initialization error, protocol-only loading ownership must be cleared so a later data WebSocket close cannot trigger a duplicate reload or replace the visible retryable error. Keep the existing shared corpus/request path and preserve the original error and retry behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After a terminal shared initialization error, protocol-only loading ownership/state is cleared so the failed attempt is no longer treated as an active load.
- [ ] #2 A WebSocket close that occurs after that terminal error does not trigger a reload or any duplicate corpus/data request.
- [ ] #3 The browser continues to show the original terminal error with its retry affordance after the socket close; it is not replaced by loading, empty, or another error state.
- [ ] #4 Focused regression coverage exercises terminal error followed by socket close and proves both the absence of a second request and preservation of the visible retryable error.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
