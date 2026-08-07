---
id: BACK-591
title: Decide how board task creation interacts with prefiltered views
status: To Do
assignee: []
created_date: '2026-08-07 20:45'
labels:
  - tui
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/833'
priority: low
type: bug
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from Codex review of PR #833 (BACK-565, TUI task composer and board).

This task needs a maintainer product decision before any implementation. The first step is presenting the options to Alex and recording the chosen behavior on this task; do not pick one unilaterally.

The finding: when the board is reached by pressing Tab from a prefiltered view (for example `backlog task list --parent TASK-1`, which supplies only the matching children), the parent predicate is not part of KanbanSharedFilters. A task created through the composer is therefore inserted and focused on the board even when it does not match the filter scope the user is currently looking at (src/ui/unified-view.ts around line 499).

Candidate behaviors to put to Alex: insert the new task anyway and make that intentional; respect the active filter and show a notice that the created task exists outside the current view; or block creation while a prefiltered scope is active. They differ in how far a filtered board can be trusted to mean what it says, which makes this a product call rather than an implementation detail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The behavior for creating a task from a board reached through a prefiltered view is decided by the maintainer and recorded on this task before implementation starts
- [ ] #2 Creating a task from a prefiltered board matches the recorded decision, including what the user sees when the new task falls outside the filter scope
- [ ] #3 Task creation from an unfiltered board is unchanged
- [ ] #4 A test covers the prefiltered flow end to end: prefiltered task list, Tab to board, create a task that falls outside the filter
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
