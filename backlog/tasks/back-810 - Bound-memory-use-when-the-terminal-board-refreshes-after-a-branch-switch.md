---
id: BACK-810
title: Bound memory use when the terminal board refreshes after a branch switch
status: Done
assignee:
  - '@codex'
created_date: '2026-11-19T20:21:00Z'
updated_date: '2026-11-19T20:27:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/pull/1173
  - src/utils/task-watcher.ts
  - src/file-system/operations.ts
  - src/ui/unified-view.ts
modified_files:
  - src/test/task-watcher.test.ts
  - src/file-system/operations.ts
  - src/utils/task-watcher.ts
  - src/test/unified-view-loading.test.ts
  - src/ui/unified-view.ts
  - scripts/run-ci-tests.ts
priority: high
type: bug
ordinal: 410000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switching Git branches while backlog board is open can update hundreds of task files together. The watcher reads all active and archived tasks separately for each file. On the native Mac board a switch changing 1,353 tasks crossed 1 GiB before the updates finished. The original contribution and Windows measurements are in PR #1173.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A burst of file changes shares full-backlog reads and publishes the updated status for every changed task.
- [x] #2 A change received during a read is checked against fresh task data. Existing rules for ambiguous, archived and partially written tasks still apply.
- [x] #3 The native board finishes the 1,353-task branch switch that crossed 1 GiB on the same Mac. A portable watcher regression test can be run on Windows.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the watcher read-sharing approach from PR #1173 on current main and keep the existing rules for loading tasks by ID.
2. Exercise overlapping changes, retries and published task states in focused tests.
3. Measure the compiled board on the same branch switch on macOS, run the project checks, and publish a PR that can be checked out on Windows.

4. Batch terminal view updates in arrival order. The file watcher completed the 1,353 updates at 142 MiB with shared reads, while redrawing the board per task still crossed 1 GiB.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
On main the portable 40-file test counted 80 full active-task reads. A second regression test reproduced an older status being published after another edit arrived during the previous read.

Bun 1.4.4 on an Apple M5, current main c03a60e1. In a temporary Git repository, the branch switch moved all 1,353 tasks from To Do to In Progress. Main crossed the 1 GiB stop point before the board finished. With shared reads and grouped redraws, the compiled board displayed all 1,353 updated cards in 2.32 seconds and peaked at 262.7 MiB resident (156.6 MiB idle). The watcher-only run finished with eight active-task listings and at most one at a time. The 567-test macOS platform profile and two interactive terminal tests passed. Both watcher and view regression suites are included in the Windows/macOS CI profile.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Share active and archived task reads during file changes, discard a read superseded by a newer edit, and publish each group of updates to the terminal in order. The full 1,353-task switch finished on macOS while preserving task identity and selection.
<!-- SECTION:FINAL_SUMMARY:END -->
