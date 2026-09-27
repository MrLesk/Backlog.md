---
id: BACK-535.6
title: Consolidate compiled build coverage and CI diagnostics
status: Done
assignee:
  - '@build-ci-cleanup'
created_date: '2026-07-11 12:53'
updated_date: '2026-07-11 13:15'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: high
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove redundant compiled-executable work from the general test suite while preserving explicit packaged CLI, browser, MCP, TUI, and platform smoke contracts in build/CI gates. Make build failures and test diagnostics visible without increasing timeouts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The general test suite no longer compiles the executable redundantly during every platform/shard run
- [x] #2 A dedicated build gate fails explicitly when compilation or packaged CLI/browser/MCP/TUI smoke checks fail
- [x] #3 Linux, macOS, and Windows packaging coverage is preserved and documented by CI
- [x] #4 CI uploads machine-readable test diagnostics when supported by the test runner
- [x] #5 Local and CI runtime effects are measured, with focused stress plus full type, lint, build, and test verification
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce and measure the current build test under isolated and concurrent load. 2. Trace duplicated build and packaging contracts across tests, scripts, and workflows. 3. Move compiled smoke coverage to the dedicated platform build gate and remove redundant in-suite compilation. 4. Make build and test failures explicit and retain useful CI diagnostics. 5. Run focused stress, full checks, and cross-platform CI before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery (L2): `src/test/build.test.ts` duplicated the dedicated three-platform `compile-and-smoke-test` matrix. The unit-suite copy compiled once on Ubuntu, once on macOS, and once in a Windows shard; it also allowed selected build failures to return as passes. Isolated baseline was 2.38–2.58s. Four concurrent copies each took 5.06–5.07s, reproducing the outer-timeout boundary under load. Public contracts retained in the dedicated gate: compiled CLI help/version, embedded browser assets/cache headers, MCP tools/resources, Linux compiled TUI editor handoff, and Linux/macOS/Windows compilation. CI already emitted JUnit but never preserved it.

Implementation verification: moved compiled package assertions into a dedicated standalone smoke script run after the existing platform matrix build; removed the general-suite packaging test and its build-error skip. The smoke script bounds CLI child exit/output, browser polling/fetch/exit/stderr, and MCP operations/child close; it aggregates primary and cleanup failures. Preserved prior 8s non-Windows/16s Windows bounds. Added always-uploaded JUnit artifacts for Ubuntu, macOS, and all three Windows shards. Local compiled build + smoke passed, post-review smoke stress passed 4/4, and missing executable failed explicitly. Full isolated suite passed 1,665, skipped 2, failed 0 across 188 files (271.71s under concurrent diagnostic load), versus one extra packaging test/file before consolidation. Typecheck, Biome, workflow YAML parse, and diff checks passed.

First exact implementation-head CI (run 29153820460) passed all gates: compiled build/smoke Ubuntu 19s, macOS 31s, Windows 1m35s; Ubuntu unit 3m47s; macOS unit 5m50s; Windows shards 4m51s/4m14s/3m57s plus aggregate 3s. CodeQL run 29153819983 passed both analyses. Five non-empty JUnit artifacts were verified: Ubuntu 66,122 bytes, macOS 67,373 bytes, and Windows shards 23,502/21,991/22,269 bytes. Independent stage-1 specification and stage-2 code-quality reviews approved the frozen implementation with no blockers. Nonblocking future consideration: the build matrix still uses its pre-existing fail-fast default, so a later reliability slice may choose `fail-fast: false` for broader failure diagnostics; this change does not regress it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consolidated compiled packaging coverage into the existing Linux/macOS/Windows build matrix, eliminating redundant in-suite compilation and removing a build-error skip that could pass silently. Retained real compiled CLI, browser, MCP, and Linux TUI smoke coverage with bounded fail-visible teardown, and preserved every unit job JUnit report as a CI artifact. Verified locally with 4/4 smoke stress, a full 1,665-pass suite, type/lint/build checks, two independent reviews, green three-platform CI, five JUnit artifacts, and green CodeQL.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
