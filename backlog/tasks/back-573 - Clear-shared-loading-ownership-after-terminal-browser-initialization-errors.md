---
id: BACK-573
title: Clear shared loading ownership after terminal browser initialization errors
status: Done
assignee:
  - '@codex'
created_date: '2026-08-03 21:28'
updated_date: '2026-08-03 21:34'
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
- [x] #1 After a terminal shared initialization error, protocol-only loading ownership/state is cleared so the failed attempt is no longer treated as an active load.
- [x] #2 A WebSocket close that occurs after that terminal error does not trigger a reload or any duplicate corpus/data request.
- [x] #3 The browser continues to show the original terminal error with its retry affordance after the socket close; it is not replaced by loading, empty, or another error state.
- [x] #4 Focused regression coverage exercises terminal error followed by socket close and proves both the absence of a second request and preservation of the visible retryable error.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace the shared browser loading protocol and its terminal error/socket-close lifecycle from merged BACK-571.
2. Add a focused browser regression that sends a protocol loading frame, then terminal error and WebSocket close, asserting no follow-up data request and the retained retryable error.
3. Make the smallest state-ownership change that clears protocol-only loading on terminal error while retaining existing success, retry, active-request, and passive-client behavior.
4. Run focused browser tests, then TypeScript, Biome, build, and the broader test suite; record objective evidence and finalize the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the minimal browser protocol ownership reset on terminal loading errors. Added a TDD regression for loading → terminal error → socket close, asserting no follow-up request and retention of the original retryable error. Focused browser protocol/UI tests, TypeScript, and Biome pass.

Validation passed: bun test src/test/web-task-detail-deeplink.test.tsx src/test/web-side-navigation-loading.test.tsx src/test/browser-loading-state.test.ts; bunx tsc --noEmit; bun run check .; bun run build; and bun test --reporter=dot.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cleared protocol-only loading ownership on terminal browser initialization errors so socket close cannot reload or replace the retryable error. Added regression coverage for loading → error → socket close, proving zero follow-up requests and preserved retry UI; verified with focused and full test suites, TypeScript, Biome, and build.
<!-- SECTION:FINAL_SUMMARY:END -->
