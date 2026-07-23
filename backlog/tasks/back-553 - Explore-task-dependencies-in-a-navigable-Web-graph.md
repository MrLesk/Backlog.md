---
id: BACK-553
title: Explore task dependencies in a navigable Web graph
status: To Do
assignee: []
created_date: '2026-07-18 16:10'
updated_date: '2026-07-18 16:11'
labels:
  - web
dependencies:
  - BACK-546
type: feature
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give people a visual workspace for understanding implemented history, current work, and what can be tackled next. The browser should present existing task dependencies as a polished, read-only graph on a free canvas, inspired by the supplied video’s connected-card navigation.

This is not a restoration of the sequence command or mutation model removed by BACK-520. The graph derives from existing task records and dependency relationships. Readiness and blocked semantics come from BACK-546. A computed visual boundary labeled `Sequence` identifies tasks that are currently unblocked so people can immediately see the available next work.

Scope is the Web UI only. CLI, MCP, TUI, task ordering, dependency mutation, and manual sequence ordering remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Web UI provides a discoverable graph view that renders all non-archived tasks across configured statuses, including completed task records.
- [ ] #2 Dependency direction is visually consistent: users can navigate upward into completed implementation history and across or downward into current and subsequent work.
- [ ] #3 Tasks connected by dependencies render as distinct task cards joined by directional edges, and cards expose enough identity and state to distinguish task ID, title, status, and readiness.
- [ ] #4 The graph is presented on a free canvas that supports pointer and keyboard-accessible pan, zoom, and navigation without forcing users through a fixed linear order.
- [ ] #5 Selecting a task opens useful task detail while preserving the user's canvas position and surrounding graph context when the detail is closed.
- [ ] #6 Tasks with no dependency connection remain discoverable and selectable rather than disappearing from the graph.
- [ ] #7 Missing dependencies and dependency cycles are represented visibly and honestly without inventing edges, readiness, or a valid execution order.
- [ ] #8 A computed visual boundary labeled `Sequence` groups the tasks currently classified as unblocked by the readiness semantics delivered in BACK-546, and updates when task or dependency state changes.
- [ ] #9 The Sequence boundary is derived presentation state only; it does not persist a sequence, reorder tasks, or mutate dependencies.
- [ ] #10 The primary desktop layout remains legible and usable with larger graphs, while narrow browser widths retain best-effort access without introducing horizontal page overflow or blocking task selection.
- [ ] #11 Rendered browser tests and interactive QA cover completed history, current and next work, branching and converging dependencies, disconnected tasks, missing dependencies, cycles, Sequence grouping, selection context, pan, zoom, and narrow behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
