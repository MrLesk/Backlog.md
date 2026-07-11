---
id: BACK-535.6
title: Consolidate compiled build coverage and CI diagnostics
status: In Progress
assignee:
  - '@build-ci-cleanup'
created_date: '2026-07-11 12:53'
updated_date: '2026-07-11 13:04'
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
- [ ] #3 Linux, macOS, and Windows packaging coverage is preserved and documented by CI
- [x] #4 CI uploads machine-readable test diagnostics when supported by the test runner
- [ ] #5 Local and CI runtime effects are measured, with focused stress plus full type, lint, build, and test verification
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce and measure the current build test under isolated and concurrent load. 2. Trace duplicated build and packaging contracts across tests, scripts, and workflows. 3. Move compiled smoke coverage to the dedicated platform build gate and remove redundant in-suite compilation. 4. Make build and test failures explicit and retain useful CI diagnostics. 5. Run focused stress, full checks, and cross-platform CI before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery (L2): `src/test/build.test.ts` duplicated the dedicated three-platform `compile-and-smoke-test` matrix. The unit-suite copy compiled once on Ubuntu, once on macOS, and once in a Windows shard; it also allowed selected build failures to return as passes. Isolated baseline was 2.38–2.58s. Four concurrent copies each took 5.06–5.07s, reproducing the outer-timeout boundary under load. Public contracts retained in the dedicated gate: compiled CLI help/version, embedded browser assets/cache headers, MCP tools/resources, Linux compiled TUI editor handoff, and Linux/macOS/Windows compilation. CI already emitted JUnit but never preserved it.

Implementation verification: moved compiled package assertions into a dedicated standalone smoke script run after the existing platform matrix build; removed the general-suite packaging test and its build-error skip. The smoke script bounds CLI child exit/output, browser polling/fetch/exit/stderr, and MCP operations/child close; it aggregates primary and cleanup failures. Preserved prior 8s non-Windows/16s Windows bounds. Added always-uploaded JUnit artifacts for Ubuntu, macOS, and all three Windows shards. Local compiled build + smoke passed, post-review smoke stress passed 4/4, and missing executable failed explicitly. Full isolated suite passed 1,665, skipped 2, failed 0 across 188 files (271.71s under concurrent diagnostic load), versus one extra packaging test/file before consolidation. Typecheck, Biome, workflow YAML parse, and diff checks passed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
