---
id: BACK-688
title: Respect most_progressed strategy across branch task copies
status: Done
assignee:
  - '@jan'
created_date: '2026-09-17 07:32'
updated_date: '2026-09-17 07:35'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1024'
type: bug
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #1024 reports that when the current checkout and another local branch both contain a task, branch indexing occurs but the local working-copy record always wins before resolution strategy is evaluated. This hides a task status advanced on its work branch from board, task list, and overview in the originating checkout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With taskResolutionStrategy set to most_progressed, a higher-ranked task status found on another scanned branch is selected over the current checkout copy.
- [x] #2 When statuses have equal progress, the current checkout remains the deterministic preferred record.
- [x] #3 Regression coverage exercises resolution with both a working-copy record and a branch record.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Exercise task identity resolution with matching working-copy and branch records.
2. Rank statuses before the working-copy tie-break for most_progressed only.
3. Run the focused identity tests and project checks, then record verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved most_progressed status ranking ahead of the working-copy tie-break and added working-copy versus branch regression coverage. Focused identity tests, TypeScript, and Biome checks pass. The full suite has unrelated existing failures in src/test/tui-task-composer.test.ts involving Git hook behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed most_progressed resolution so a higher-status branch record can beat an older working-copy record; equal-progress records still prefer the working copy. Verified with src/test/task-identity-index.test.ts (7 pass), bunx tsc --noEmit, and bun run check .. Full bun test has unrelated Git hook failures in src/test/tui-task-composer.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
