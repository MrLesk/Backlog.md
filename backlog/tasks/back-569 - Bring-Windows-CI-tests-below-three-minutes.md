---
id: BACK-569
title: Bring Windows CI tests below three minutes
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-03 16:30'
updated_date: '2026-08-03 18:32'
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

Architecture v3: converted seven additional MCP suites to filesystem-only setup, retaining explicit Git initialization only for three document auto-commit/index-boundary tests. The 33 affected tests pass in 9.19s. A full local four-worker run completed in 269.99s (1842 pass, 19 platform skips, 13 known local environment failures), versus 247.94s in v2; the variance is concentrated in unrelated long-running CLI/Git/TUI suites, so use GitHub Windows timing as the acceptance measurement. Windows test CI now skips actions/cache because the latest cache restore/save cost about 48s while bun install cost 24s.

Architecture v3: converted seven additional MCP suites to filesystem-only setup, retaining explicit Git initialization only for three document auto-commit/index-boundary tests. The 33 affected tests pass in 9.19s. A full local four-worker run completed in 269.99s (1842 pass, 19 platform skips, 13 known local environment failures), versus 247.94s in v2; the variance is concentrated in unrelated long-running CLI/Git/TUI suites, so use GitHub Windows timing as the acceptance measurement. Windows test CI now skips actions/cache because the latest cache restore/save cost about 48s while bun install cost 24s.

Live CI correction: skipping actions/cache on Windows was rejected after the first PR run showed the uncached bun install still running after 60s, already slower than the previous 48s combined cache restore/save cost. Restored the cache; this experiment is not part of the final strategy.

First PR evidence: the full Windows test step dropped from 889s to 221s and the uncached complete job from 982s to 330s. JUnit contained 766 aggregate test-seconds, giving a theoretical four-worker floor of 191.55s before setup, so repeating the entire platform-neutral suite on Windows cannot meet the 180s complete-job target. Reworked CI responsibilities: Ubuntu owns the full behavioral suite; Windows and macOS run an explicit 37-file/373-test platform-contract profile covering filesystem/path/locking, real Git/worktrees, shipped CLI/process/editor boundaries, MCP stdio, network lifecycle, and Unicode. The profile completes locally in 47.96s; known local failures require Unix shell commands absent from this host. Also raised only the three repeatable Unix process-lifecycle test timeouts exposed by four-worker CI contention.

Platform-profile CI evidence: Windows executed all 373 contract tests successfully in 41s. The complete job was 207s only because actions/cache took 74s and bun install then took another 62s; together dependency setup consumed 136s. Corrected the earlier cache comparison and limited dependency caching plus duplicate type/lint checks to the Ubuntu full-profile job. The measured uncached Windows install was 76s, projecting about 142s for the complete platform job with the already-measured 41s test step.

Final full-suite flake diagnosis: cli-launcher signal fixtures consistently hung at the global timeout under four-worker Ubuntu runs, including after raising the timeout to 30s, proving a runtime deadlock rather than slow execution. The published cli.cjs launcher has a Node shebang, but the test invoked it through Bun's process.execPath. Changed the harness to launch cli.cjs with Node, matching production and avoiding Bun's nested signalled-child deadlock; restored the normal 10s bound.
<!-- SECTION:NOTES:END -->
