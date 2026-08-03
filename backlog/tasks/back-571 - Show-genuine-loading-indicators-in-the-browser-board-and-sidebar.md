---
id: BACK-571
title: Show genuine loading indicators in the browser board and sidebar
status: To Do
assignee: []
created_date: '2026-08-03 20:02'
updated_date: '2026-08-03 20:04'
labels: []
dependencies: []
type: enhancement
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow up on BACK-570 without undoing its asynchronous, idle-stable browser startup. Keep the browser shell visible while the existing shared Core-backed data request loads, and display the exact progress messages that Core already emits to the TUI. Bridge those existing messages through the server's WebSocket or an equivalent shared progress channel into the browser loading presentation, retaining the latest in-flight phase for browsers that connect after loading has started. Preserve a single shared data source and distinguish loading, loaded-empty, and error states without timer-based fake progress, a second task store, or an independent duplicate corpus load.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 While shared Core data is loading, the browser displays the existing Core progress callback messages verbatim—the same messages shown by the TUI—rather than generic or browser-only substitutes
- [ ] #2 Core progress messages reach the browser through the server's existing WebSocket or an equivalent shared progress channel tied to the same in-flight corpus initialization, and the latest phase is retained and sent to browser connections that arrive after loading has started
- [ ] #3 Progress delivery never starts a second store, corpus scan, or data request and never synthesizes phases from timers or elapsed time
- [ ] #4 While the shared load is pending, sidebar task, document, and decision counts and collections show the current Core progress message with a genuine loading indicator or skeleton instead of 0, No items, or another loaded-empty presentation
- [ ] #5 While task data is pending, the Kanban board shows the current Core progress message with a genuine loading state or skeleton and does not present zero cards, empty columns, or Empty as if loading had completed
- [ ] #6 When loading resolves, the progress presentation clears and the sidebar and Kanban show the actual counts, collections, and task cards
- [ ] #7 Loaded-empty and load-error states are visually and behaviorally distinct from loading; errors remain visible and retryable, and focused web/server tests cover verbatim progress delivery including late connections, loading, loaded data, loaded-empty, error/retry, stable mounting, and the absence of timer-based fake progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
