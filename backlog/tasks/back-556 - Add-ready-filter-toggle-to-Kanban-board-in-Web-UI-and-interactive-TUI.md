---
id: BACK-556
title: Add ready filter toggle to Kanban board in Web UI and interactive TUI
status: Done
assignee:
  - '@codex'
created_date: '2026-07-24 08:21'
updated_date: '2026-07-24 08:40'
labels: []
dependencies: []
priority: medium
type: feature
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend Kanban filtering across Web UI and TUI to support filtering board tasks by readiness (getTaskReadiness.isReady). Add ready toggle button in Web Kanban header bar and hotkey/shared filter support in TUI.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a Ready only toggle to the Web Kanban filter bar and preserve it in the board URL. 2. Add an R shortcut to the interactive Kanban board, carrying the filter across unified views. 3. Resolve readiness through the shared helper against the complete task graph and verify Web and TUI regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the Web Kanban Ready only button and the interactive Kanban R shortcut. Both reuse getTaskReadiness; the TUI evaluates active board candidates against the complete graph so completed dependencies resolve correctly. Verified with bun test, bunx tsc --noEmit, bun run check ., and bun run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added ready-only Kanban filtering in the Web UI and interactive TUI. Verified browser URL/filter behavior and full-graph TUI dependency behavior with regression tests, full tests, type-checking, Biome, and production build.
<!-- SECTION:FINAL_SUMMARY:END -->
