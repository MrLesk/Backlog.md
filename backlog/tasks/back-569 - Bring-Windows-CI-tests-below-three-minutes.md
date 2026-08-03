---
id: BACK-569
title: Bring Windows CI tests below three minutes
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-03 16:30'
updated_date: '2026-08-03 17:54'
labels: []
dependencies: []
priority: high
type: task
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows CI has regressed to nearly 20 minutes as the test suite has grown. Measure recent GitHub Actions and local Windows test performance, identify slow or redundant coverage, and reduce the Windows test workflow wall-clock duration without weakening meaningful behavioral guarantees.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Recent successful GitHub Actions runs and comparable local Windows runs identify the slowest test files or phases with recorded timings
- [ ] #2 The Windows test workflow completes in less than three minutes on GitHub Actions
- [ ] #3 Test execution uses safe parallelism while tests that require isolation remain deterministic
- [ ] #4 Redundant or low-value tests removed or consolidated are documented with the coverage rationale
- [ ] #5 All retained tests, type checks, lint checks, and build validation pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. [x] Baseline recent Windows CI and local Bun 1.3.14; classify runtime by architectural boundary.
2. [x] Benchmark source CLI, bundled CLI, compiled CLI, and bounded file concurrency.
3. [x] Define the simpler test architecture: filesystem-only by default, explicit Git boundaries, one public-surface path per behavior.
4. [x] Finish shared fixture migration, deduplication, and the minimal CI runner changes.
5. [ ] Verify the complete Windows job below three minutes on GitHub Actions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial GitHub evidence: 12 recent successful Windows test steps took 766-1050 seconds; the latest took 889 seconds within a 982-second job. Latest Windows JUnit hotspots were tui-task-composer.test.ts 105.55s, acceptance-criteria.test.ts 37.49s, server-tasks-spa-fallback.test.ts 36.65s, core.test.ts 33.18s, and mcp-milestones.test.ts 22.05s. The prior BACK-524 three-shard run still took 198-231 seconds per shard job because tests took 98-153s and setup took 70-126s; actions/cache alone cost 32-80s. Source/history review found implementation-notes-append.test.ts duplicates append-implementation-notes.test.ts from the same feature commit, while the latter is a coverage superset; removing the duplicate saves about 4.7-5.6 Windows seconds per run without losing behavior coverage.

Direction correction: file sharding is rejected as the primary solution because it multiplies setup and masks repeated full-CLI and Git initialization costs. No sharding implementation was started. The investigation will use the existing JUnit baseline to redesign the test execution architecture before touching CI parallelism.

Architecture findings: 91% of sequential runtime was in CLI subprocess, Git, MCP, TUI, and HTTP boundaries; 516 pure unit tests totaled under one second, so test count was not the bottleneck. Local full suite improved from 1,413.81s sequential to 398.15s with four file workers. After removing duplicate coverage, using a prebuilt CLI for subprocess tests, defaulting non-Git fixtures to filesystem-only, and configuring Git identity once per runner, the same 1,874-test suite completed in 247.94s locally with four workers. Representative reductions: acceptance criteria 61.84s to 11.49s; MCP tasks 50.71s to 6.84s; MCP milestones 43.92s to 11.95s; TUI composer about 129.66s under contention to 78.00s standalone. The previous sharding direction remains rejected; every OS still runs the identical full suite.
<!-- SECTION:NOTES:END -->
