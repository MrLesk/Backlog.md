---
id: BACK-571
title: Show genuine loading indicators in the browser board and sidebar
status: Done
assignee:
  - '@codex'
created_date: '2026-08-03 20:02'
updated_date: '2026-08-03 20:58'
labels: []
dependencies: []
modified_files:
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/server/index.ts
  - src/utils/browser-loading-state.ts
  - src/web/App.tsx
  - src/web/components/Layout.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/Board.tsx
  - src/test/browser-loading-state.test.ts
  - src/test/server-loading-progress.test.ts
  - src/test/web-side-navigation-loading.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
type: enhancement
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow up on BACK-570 without undoing its asynchronous, idle-stable browser startup. Keep the browser shell visible while the existing shared Core-backed data request loads, and display the exact progress messages that Core already emits to the TUI. Bridge those existing messages through the server's WebSocket or an equivalent shared progress channel into the browser loading presentation, retaining the latest in-flight phase for browsers that connect after loading has started. Preserve a single shared data source and distinguish loading, loaded-empty, and error states without timer-based fake progress, a second task store, or an independent duplicate corpus load.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While shared Core data is loading, the browser displays the existing Core progress callback messages verbatim—the same messages shown by the TUI—rather than generic or browser-only substitutes
- [x] #2 Core progress messages reach the browser through the server's existing WebSocket or an equivalent shared progress channel tied to the same in-flight corpus initialization, and the latest phase is retained and sent to browser connections that arrive after loading has started
- [x] #3 Progress delivery never starts a second store, corpus scan, or data request and never synthesizes phases from timers or elapsed time
- [x] #4 While the shared load is pending, sidebar task, document, and decision counts and collections show the current Core progress message with a genuine loading indicator or skeleton instead of 0, No items, or another loaded-empty presentation
- [x] #5 While task data is pending, the Kanban board shows the current Core progress message with a genuine loading state or skeleton and does not present zero cards, empty columns, or Empty as if loading had completed
- [x] #6 When loading resolves, the progress presentation clears and the sidebar and Kanban show the actual counts, collections, and task cards
- [x] #7 Loaded-empty and load-error states are visually and behaviorally distinct from loading; errors remain visible and retryable, and focused web/server tests cover verbatim progress delivery including late connections, loading, loaded data, loaded-empty, error/retry, stable mounting, and the absence of timer-based fake progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused failing Core/server tests that prove the existing shared ContentStore initialization forwards Core progress verbatim, retains the latest phase for late WebSocket connections, publishes completion/error/retry states, and remains a single deduplicated load.
2. Bridge the existing Core loadTasks progress callback through BacklogServer’s current WebSocket while allowing the browser shell/socket to connect during the same in-flight services promise; retain only the latest loading state and reset it correctly for retry.
3. Add focused React tests and update the existing App/Layout/sidebar/Kanban state path so pending data shows the verbatim Core phase with genuine indicators, loaded-empty renders only after success, and failures are distinct and retryable without remounting the shell.
4. Run targeted tests, then typecheck, Biome, build, and the appropriate full suite; simplify the final diff, finalize BACK-571 through the CLI, and publish a ready PR titled exactly “BACK-571 - Show genuine loading indicators in the browser board and sidebar”.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one retained browser loading-state channel on BacklogServer around the existing deduplicated servicesReadyPromise and Core-backed ContentStore initialization. Core's existing progress callback is forwarded verbatim; WebSocket connections receive the retained phase immediately, the first socket still starts the same shared initialization, failures remain retained without auto-retrying, and an HTTP retry reuses the same store initialization path. React keeps the shell mounted and distinguishes pending skeleton/progress, loaded-empty, loaded data, and retryable error states. Validation: focused loading/reorder/UI tests 33 pass; full bun test 1,883 pass, 5 expected skips, 0 fail; bunx tsc --noEmit, bun run check ., and bun run build pass. Rendered browser QA verified the exact Core phase in sidebar and Kanban, no premature empty presentation, late-connection retention, loaded cards/counts, and sidebar collapse/expand.

Codex review follow-up: scoped the Core progress callback to ContentStore initialization only, preventing later watcher/manual refreshes from emitting unterminated browser loading phases. Added passive-client reconciliation on shared retry completion while tracking active data-request ownership so a tab with an in-flight request does not start a duplicate. Added focused regressions for both findings. Final validation: focused suite 88 pass, full bun test 1,885 pass with 5 expected skips and 0 failures; typecheck, Biome, and build pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bridged the existing Core corpus progress callback through a retained WebSocket loading state scoped strictly to shared initialization, and updated the mounted browser sidebar and Kanban to show genuine phase/skeleton, loaded-empty, loaded-data, and retryable error presentations. Passive tabs now reconcile once after another tab's successful retry without duplicating an active request. Verified by focused protocol/Core/server/React coverage, rendered browser interaction, 1,885 passing repository tests, typecheck, Biome, and production build.
<!-- SECTION:FINAL_SUMMARY:END -->
