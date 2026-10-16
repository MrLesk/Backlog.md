---
id: BACK-539
title: Surface duplicate task ID warning in TUI task list and detail views
status: Done
assignee:
  - '@claude'
created_date: '2026-07-12 14:59'
updated_date: '2026-07-12 15:09'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-516 computes a duplicate-task-ID startup warning in the unified TUI view but only wires it into the Kanban board, where it renders as a 15-second transient footer. The default interactive entry (backlog task list / overview, initialView task-list) shows nothing: the stderr warning is wiped by the TUI screen takeover while duplicate tasks render side by side with identical IDs. A human browsing the primary interactive surface never learns the project has a data-integrity problem, below the manifesto bar that important information must be legible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When duplicate task IDs exist, the interactive task-list view shows the duplicate warning with the same copy as the board (pointing to backlog doctor)
- [x] #2 The warning is legible for a data-integrity alert (not lost on entry or hidden behind a transient timeout the user can miss)
- [x] #3 Tests cover warning propagation to the task-list view
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add startupWarning option to viewTaskEnhanced and render it as a persistent one-line warning bar directly above the help bar (yellow, blessed tags), sized into the pane layout via syncPaneLayout so it cannot be missed or timed out.
2. Extract the warning-bar creation as an exported helper so it is unit-testable with the repo's existing createScreen blessed test pattern.
3. Pass the already-computed startupWarning from runUnifiedView's showTaskView into viewTaskEnhanced (board path already receives it).
4. Tests: blessed component test asserting the warning renders with the doctor guidance; keep existing getDuplicateTaskStartupWarning coverage. Manual PTY verification in a throwaway project with forged duplicate IDs for the rendered task-list view.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added createStartupWarningBar (persistent one-line yellow bar above the help bar, no timeout) and a startupWarning option on viewTaskEnhanced; runUnifiedView now passes the same formatDuplicateTaskIdSummary string the board receives, and syncPaneLayout sizes panes around the bar. Verified rendered behavior under a real PTY in a throwaway project with a forged TASK-1 duplicate: the interactive task-list screen shows 'Duplicate task IDs detected: TASK-1. Run backlog doctor to preview a safe repair.' (the bar copy, distinct from the pre-TUI stderr text). Component test asserts content and height via the repo's blessed screen test pattern. 27 TUI-adjacent tests pass, tsc and biome clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The duplicate-task-ID startup warning was only wired into the Kanban board as a 15s transient footer, so the default interactive task-list view showed nothing when duplicates existed. viewTaskEnhanced now renders the same warning as a persistent bar above the help bar in both list and detail focus. Verified with a blessed component test and a live PTY capture of the rendered task-list view in a project with forged duplicates.
<!-- SECTION:FINAL_SUMMARY:END -->
