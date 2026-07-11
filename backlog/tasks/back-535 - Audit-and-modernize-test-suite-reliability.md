---
id: BACK-535
title: Audit and modernize test-suite reliability
status: In Progress
assignee:
  - '@test-hygiene-audit'
created_date: '2026-07-11 08:47'
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
- [ ] #1 A versioned audit inventories every test file, suite runtime distribution, recent CI failure history, filesystem/watcher/timer/process/network dependencies, global process-state mutations, leaked handles or unhandled rejections, duplicated coverage, and implementation-detail assertions
- [ ] #2 Every consolidation or removal candidate names the shipped CLI, MCP, instruction, TUI, browser, persistence, or packaging contract it protects and the retained or replacement coverage; ambiguous contracts are escalated before removal
- [ ] #3 Tests labelled as CLI or another shipped surface execute that real surface; simulated helper output and Core-only surrogates are replaced or accurately reclassified
- [ ] #4 Timing-sensitive tests use observable synchronization and cancellable cleanup rather than arbitrary sleeps, broad retries, or increased timeouts as the primary fix
- [ ] #5 Redundant suites and fixtures are consolidated in small independently reviewable slices with no loss of documented public behavior coverage
- [ ] #6 The Testing Style Guide is updated to require fail-visible cleanup, restoration of mutated global state, resource disposal, public-contract naming, and platform-specific justification
- [ ] #7 CI platform and shard coverage is justified by platform-specific risk, reports useful diagnostics, and has a measured runtime baseline plus an approved target
- [ ] #8 Each cleanup slice passes focused stress runs and the full type, lint, build, and test gates; final verification includes repeated clean runs on Linux, macOS, and Windows
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Baseline current main and reconcile active PR failures with BACK-533 and BACK-534.
2. Stabilize resource lifecycle and timing helpers, prioritizing watcher, server, process, and environment isolation.
3. Replace misleading surface simulations with real CLI/MCP/browser/TUI contract tests and retain focused domain units.
4. Consolidate duplicated suites and remove only evidence-backed obsolete fixtures or assertions.
5. Refresh the Testing Style Guide and CI diagnostics/platform matrix using measured runtime data.
6. Re-run repeated focused stress and full cross-platform verification, then document retained coverage and runtime change.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
