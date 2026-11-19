---
id: BACK-811
title: Use the configured final status in project statistics
status: Done
assignee:
  - '@codex'
created_date: '2026-11-19T22:28:00Z'
updated_date: '2026-11-19T22:31:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1224
  - src/core/statistics.ts
  - src/utils/terminal-status.ts
modified_files:
  - src/test/statistics.test.ts
  - src/core/statistics.ts
priority: medium
type: bug
ordinal: 411000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Statistics page and backlog overview treat the literal status Done as finished even when a project puts another status last. A board with one open task depending on one closed task showed 0% complete and listed the open task as blocked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Completion counts and percentages use the final configured status for active and archived tasks. Done in an earlier column counts as unfinished.
- [x] #2 Task age, stale tasks and blocked dependencies follow the same completion rule in the statistics shown by the web and CLI.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the existing statistics tests with a custom final column and reproduce the wrong progress and health results.
2. Reuse the project’s terminal-status check wherever statistics need to know whether a task or dependency is finished.
3. Verify the Statistics page and backlog overview on the same sample project and run the relevant checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before the fix, the tests counted one finished task where there were two and reported average task age as 13 days instead of seven. After the fix, all 21 focused tests, the type check and Biome passed. In a project with one OPEN task depending on one CLOSED task, Chrome, the statistics API and the compiled backlog overview command showed 50% completion and zero blocked tasks. The results stayed the same after archiving the CLOSED task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Project statistics now use the last configured status for completion, task age, and stale or blocked work. An earlier column named Done counts as unfinished. An archived task in the final status counts as complete and satisfies its dependents.
<!-- SECTION:FINAL_SUMMARY:END -->
