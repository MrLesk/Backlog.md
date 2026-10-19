---
id: BACK-541
title: Archive one-week-old completed backlog tasks
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-07-12 20:09'
updated_date: '2026-07-12 20:15'
labels: []
dependencies: []
type: chore
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep the active backlog focused by publishing the user-approved one-week cleanup of terminal tasks. This housekeeping change preserves each task record while moving eligible completed work out of the active task directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Exactly the 151 tasks selected by the one-week cleanup are moved from backlog/tasks to backlog/completed
- [x] #2 Each moved task keeps the same filename and byte-identical contents
- [x] #3 No active task, source code, configuration, or unrelated file is changed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit the cleanup index for exactly 151 byte-identical task moves and no unrelated state. 2. Publish the moves with this bounded housekeeping record. 3. Rebase onto current origin/main and repeat the exact-scope verification before pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial audit: 151 R100 moves from backlog/tasks to backlog/completed; zero content changes, unstaged files, or untracked files.

Final verification before publication: 151 status-Done records are R100 moves with identical filenames and blob hashes; latest effective task date is 2026-07-04 18:15, older than the one-week cutoff; no unstaged, untracked, active-task, source, or configuration changes. bun test src/test/cleanup.test.ts passed 10/10. The full suite passed 1693 tests with 2 skips and one unrelated existing 5-second SPA branch-scan hook timeout; it was not rerun.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published the approved one-week backlog cleanup by moving exactly 151 eligible Done task records into backlog/completed without changing their filenames or contents. Verified exact Git scope and blob identity, terminal status and age eligibility, a clean worktree outside this task, and the cleanup suite (10/10 passing).
<!-- SECTION:FINAL_SUMMARY:END -->
