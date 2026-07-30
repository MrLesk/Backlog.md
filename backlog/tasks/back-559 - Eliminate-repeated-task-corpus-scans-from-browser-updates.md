---
id: BACK-559
title: Eliminate repeated task-corpus scans from browser updates
status: To Do
assignee: []
created_date: '2026-07-30 17:12'
labels:
  - web-ui
  - performance
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/807'
type: bug
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser task mutations repeatedly parse the complete active and completed task corpus. With 20 active and 430 completed tasks, a status update regressed from roughly 3 ms in v1.47.0 to roughly 607 ms on current main, while duplicate repair preview adds about 202 ms and the board can request a second refresh. Resolve task identity once per mutation, reuse one active/completed snapshot for duplicate repair, and avoid redundant board refresh work while preserving fail-closed identity behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One ordinary browser task status update performs at most one active/completed identity scan, persists the change, and returns the updated task.
- [ ] #2 Duplicate repair preview loads active and completed tasks once and reuses that snapshot for duplicate detection, existing-ID allocation input, and fingerprint preparation.
- [ ] #3 One board drag applies the returned task immediately and does not cause two duplicate-plan builds; the existing WebSocket refresh still reconciles external changes.
- [ ] #4 Fail-closed behavior remains for active/active, active/completed, zero-padded, cross-prefix, and filename/frontmatter ID collisions, and ambiguous mutations alter no file.
- [ ] #5 Completed tasks remain excluded from the active board, and current auto-commit, Git staging and commit, updated-date, and status callback behavior remains unchanged.
- [ ] #6 An ephemeral same-machine fixture with 20 active and 430 completed tasks records before and after status-update, duplicate-preview, and drag-path measurements with at least a 70 percent reduction in the combined mutation and refresh median; no durable benchmark framework is added.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
