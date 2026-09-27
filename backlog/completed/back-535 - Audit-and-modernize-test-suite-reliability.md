---
id: BACK-535
title: Audit and modernize test-suite reliability
status: Done
assignee:
  - '@triage-pr798-codex'
created_date: '2026-07-11 08:47'
updated_date: '2026-07-17 22:46'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/757'
priority: high
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish a trustworthy, maintainable test suite by separating shipped public-contract coverage from obsolete, simulated, duplicated, timing-sensitive, and implementation-detail assertions. Coordinate with BACK-533/PR #757 and BACK-534 rather than duplicating their ContentStore and milestone fixes. Test removal must be evidence-based: age alone is never sufficient, and every removed public behavior check needs an identified replacement or an explicit maintainer decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A versioned repository-level risk audit records suite and runtime distribution, recent CI failure history, filesystem/watcher/timer/process/network dependencies, global process-state mutations, leaked handles or unhandled rejections, duplicated coverage, implementation-detail assertions, and prioritized hotspots and remediation candidates
- [x] #2 Every consolidation or removal candidate names the shipped CLI, MCP, instruction, TUI, browser, persistence, or packaging contract it protects and the retained or replacement coverage; ambiguous contracts are escalated before removal
- [x] #3 Tests labelled as CLI or another shipped surface execute that real surface; simulated helper output and Core-only surrogates are replaced or accurately reclassified
- [x] #4 Timing-sensitive tests use observable synchronization and cancellable cleanup rather than arbitrary sleeps, broad retries, or increased timeouts as the primary fix
- [x] #5 Redundant suites and fixtures are consolidated in small independently reviewable slices with no loss of documented public behavior coverage
- [x] #6 The Testing Style Guide is updated to require fail-visible cleanup, restoration of mutated global state, resource disposal, public-contract naming, and platform-specific justification
- [x] #7 CI platform and shard coverage is justified by platform-specific risk, reports useful diagnostics, and has a measured runtime baseline plus an approved target
- [x] #8 Each cleanup slice passes focused stress runs and the full type, lint, build, and test gates; final verification includes repeated clean runs on Linux, macOS, and Windows
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Baseline current main and reconcile active PR failures with BACK-533 and BACK-534.
2. Stabilize resource lifecycle and timing helpers, prioritizing watcher, server, process, and environment isolation.
3. Replace misleading surface simulations with real CLI/MCP/browser/TUI contract tests and retain focused domain units.
4. Consolidate duplicated suites and remove only evidence-backed obsolete fixtures or assertions.
5. Refresh the Testing Style Guide and CI diagnostics/platform matrix using measured runtime data.
6. Re-run repeated focused stress and full cross-platform verification, then document retained coverage and runtime change.
7. Reclassify the internal board integration suite and remove redundant status-callback waits identified by Codex review.
8. Run and record a bounded leaked-handle and unhandled-rejection audit, then repeat focused and standard verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline (origin/main e9dc9c5): 189 files, 1,645 tests (1,643 pass, 2 intentional interactive-TUI skips), 42,387 test LOC. A clean macOS run took 184.87s. Latest green CI run 29115416510 took 5m54s wall-clock; critical path was Windows shard 3 at 5m46s. Across the latest 40 main CI runs, 36 passed and 4 failed: three were the same Windows priority timeout later addressed by BACK-524/#739; one exposed a real stale MCP type read during #750. Active #757 failures reconcile to BACK-533 timer cleanup plus BACK-534 queue-blocking retry work, not a separate BACK-535 implementation.

Risk inventory: 117 test files touch the filesystem, 20 use timers/sleeps, 11 exercise watchers/ContentStore, 5 spawn processes, 13 use network/server APIs, 13 mutate process environment or cwd, 12 install global DOM state, and 17 use private casts/mocks. There are 89 broad/swallowed catch sites to review. The repository Testing Style Guide currently recommends ignoring cleanup failures, which conflicts with reliable resource disposal. The working repository also contains old test/reproduction residue under tmp; do not delete it blindly because some artifacts are manual diagnostics.

Confirmed false-assurance seam: src/test/test-helpers.ts claims platform-aware CLI testing but create/edit/view/list always call Core and synthesize output; on Windows getCliHelpPlatformAware returns a hard-coded help string. This affects cli-dependency.test.ts, cli-parent-shorthand.test.ts, implementation-plan.test.ts, implementation-notes.test.ts, and portions of cli.test.ts. Replace public-surface assertions with real CLI subprocess tests; retain/reclassify focused Core persistence tests. Real replacement coverage already exists for task view/plain output, dependency domain semantics, implementation-note append, parent normalization, priority validation/filtering, and task sorting; add only missing actual --dep/--depends-on/-p/shortcut cases.

Confirmed removal/consolidation candidates: cli-priority-filtering.test.ts runs against the repository backlog rather than an isolated fixture, contains conditional/vacuous assertions, duplicates isolated coverage in cli.test.ts, priority.test.ts, task-sorting.test.ts, and cli-search-command.test.ts, and consumed 12.32s locally. bun-options.test.ts copies the implementation logic instead of invoking the shipped CLI; replace it with a real executable/subprocess environment test before deletion. config-hang-repro.test.ts uses a shared hard-coded /tmp path and an uncancelled rejecting timeout; rewrite with unique isolation and a self-cleaning timeout while retaining config/migration behavior.

Runtime hotspots by summed testcase time: cli.test.ts 20.66s, cli-priority-filtering 12.32s, server-tasks-spa-fallback 10.37s, config-watcher 9.65s, acceptance-criteria 7.13s, mcp-milestones 5.49s, core 4.98s, task-type-filtering 4.84s, cli-milestone-management 4.83s, and mcp-tasks 4.72s. CI also builds the executable inside build.test.ts during the full platform suites and again in the three-platform build matrix; build.test.ts can silently pass on selected build failures. Consolidate compilation while retaining help/version/browser/MCP/TUI package smoke coverage. Upload JUnit results and keep Windows sharding until measurements prove a safer matrix.

P3 candidates after reliability repairs: reduce duplicate MCP semantic permutations to thin adapter schema/parity/stdio coverage plus shared domain and canonical CLI tests; split/reclassify the 2,768-line cli.test.ts monolith; replace browser tests that call private React props and server tests that assert private object identity with observable user/HTTP behavior; define retention for old tmp fixtures. MCP remains a supported legacy adapter, so its public contract coverage must not be removed wholesale.

Final reconciliation on main 22a091b: all 13 linked cleanup slices are Done with checked acceptance criteria and Definition of Done, and their final commits are present on main. The repository-level audit records baseline suite size and runtime, 40-run CI failure history, resource and global-state risk counts, leak-prone catch sites, duplicated and implementation-detail coverage, runtime hotspots, and prioritized remediation candidates. Current CI run 29538363579 passed full unit and compile/smoke jobs on Ubuntu, macOS, and Windows using the approved one-full-test-job-per-OS matrix. Final local verification passed: 1,721 tests passed, 4 intentional interactive TUI tests skipped, 0 failed across 197 files; bunx tsc --noEmit, bun run check ., and bun run build also passed.

Codex review repair on PR #798: renamed src/test/cli-board-integration.test.ts to src/test/board-core-view-integration.test.ts and reworded the suite and comments to accurately identify its Core, cross-branch, and ViewSwitcher integration scope. Removed all four fixed 100/200 ms waits from status-callback.test.ts because updateTaskFromInput and reorderTask already await executeStatusChangeCallback; immediate behavior assertions passed 20 repeated focused runs (280 tests, 0 failures).

Bounded leaked-handle and unhandled-rejection audit method: Bun 1.3.14 ran the complete 197-file suite inside a 600-second process watchdog. Bun test documents that it tracks unhandled promise rejections and inter-test async errors and returns a nonzero exit for them (https://bun.com/docs/test/runtime-behavior). The run exited normally after 218.59 seconds with code 0, 1,721 passing tests, 4 intentional interactive TUI skips, and 0 failures, so zero unhandled errors were observed and no retained handle prevented process exit. Bun 1.3.14 exposes no open-handle count in bun test --help, so this audit does not claim an unsupported zero-handle count. Typecheck, Biome across 336 files, build, diff check, the focused 14-test run, and the 20x focused stress run also passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the repository-level reliability audit and 13 cleanup slices, then repaired the three Codex review gaps by accurately reclassifying internal board integration coverage, removing four redundant status-callback sleeps, and recording a bounded full-suite unhandled-error audit. Verified with 280 repeated focused passes, 1,721 full-suite passes with 4 intentional skips and zero failures or unhandled errors, normal exit within 218.59 seconds, plus clean typecheck, Biome, build, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
