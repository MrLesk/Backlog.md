---
id: BACK-706
title: Remove redundant tests while preserving shipped behavior coverage
status: Done
assignee:
  - '@codex-test-pruning'
created_date: '2026-09-28 00:15'
updated_date: '2026-09-28 00:28'
labels: []
dependencies: []
type: chore
ordinal: 336000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review the existing test suite and tests added in the current maintenance work. Remove tests that only mirror implementation, check incidental copy or structure, repeat equivalent coverage, or protect superseded internal behavior. Keep meaningful coverage for shared domain rules, data preservation, identity, task lifecycle, and supported public interfaces. This is test subtraction; production behavior and CI topology remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each removed or consolidated test has a concrete reason and, where the behavior still matters, an identified retained test that covers it.
- [x] #2 Essential identity, lifecycle, persistence, validation, and public-surface regressions remain covered; no production behavior or CI platform coverage changes.
- [x] #3 The final diff removes unnecessary test burden without new test infrastructure, and appropriate focused and full checks pass with any limitations recorded.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit domain, storage, configuration, CLI/MCP, and UI tests against the shipped surface and current implementation. Record a removal map and preserve unique identity, lifecycle, persistence, validation, platform, and harness proofs.
2. Remove redundant Core/member/accessor checks, duplicate field and config round trips, unused internal helper tests, and exact subsets of stronger existing tests. Initial owned files: src/test/core.test.ts, filesystem.test.ts, config-commands.test.ts, priority.test.ts, markdown.test.ts, documentation.test.ts, references.test.ts, final-summary.test.ts, acceptance-criteria.test.ts. None overlaps the parked BACK-694 checkpoint.
3. Incorporate independent read-only CLI/MCP and UI audit findings only after naming their exact files, reason, and retained proof. Keep production code, runner topology, and supported OS coverage unchanged.
4. Run affected tests with Bun 1.3.14 and a fresh CLI bundle. Inspect failures before any rerun. Review the final subtraction for simpler retained coverage, then freeze source for architecture review.
5. On the reviewed final source, run the existing full CI-profile suite, typecheck, Biome, and build. Record removed files/cases/lines and exact validation evidence without marking Done.

6. Reviewed independent CLI/UI candidates: delete tab-switching, line-wrapping, and board-render test files (fixture/third-party checks and duplicated board comparisons); consolidate stable-ID equality into existing board-ui case. Remove repeated helper-only agent tests, Core-only label/assignee/missing-task/edit-autocommit pseudo-CLI cases, one optional-name pseudo-init case, and a weaker task-create commit case. In server-statistics-endpoint, retain the selected-root HTTP data test but drop exact private load counts. Preserve the separate warm-cache/performance proof. These additional files do not overlap parked BACK-694 test paths.

7. Final audit subtraction: remove board-ui-selection, board-core-view-integration, and board-command fixtures that simulate their own UI data, stub the behavior under test, or call an unused internal loader. Remove the no-op ViewSwitcher preload check, duplicate heading/style accessor checks, repeated agent generation/init helpers, obsolete source-text help scan, duplicate MCP helper inventory/fallback construction, and duplicate plain root formatting. Drop incidental guide-index spacing and internal-packaging word checks. Retain real loading, sorting, board interaction, rendered output, agent guidance, CLI init, and MCP factory coverage. Explicit parked BACK-694 overlap: src/test/mcp-server.test.ts only; keep the factory inventory for future task_delete composition, remove only the redundant helper inventory, and leave the checkpoint unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed 91 test cases and six files across 29 test paths: 2,055 net test lines removed (21 added, 2,076 deleted). Production code, CI topology, and platform coverage are unchanged.

Removed whole files: board-command, board-core-view-integration, board-render, board-ui-selection, line-wrapping, and tab-switching. These constructed local options or arrays, replaced the method being tested, asserted third-party widget configuration, exercised an unused internal loader, or repeated existing board comparisons.

Retained coverage:
- Task fields, references, documentation, and final summaries: real CLI and MCP edits with persisted results; domain deduplication, replacement, absent values, and omitted frontmatter.
- Storage and configuration: actual directory writes, config round trips, CLI clear/reinitialization, custom roots, filename safety, and staged-file preservation.
- Checklists and priorities: canonical manager/serializer edits, content preservation, custom priorities, normalization, and round trips. Removed only repeated wrappers and tests of an unused internal checklist helper.
- TUI: numeric task sorting, real board loading/selection/movement, view state/callbacks, popup and composer behavior. The retained board equality case now uses separate task instances with equal IDs.
- CLI/MCP and instructions: actual CLI initialization/help/output, factory tool/resource inventory, instruction preservation and mode switching. Removed fixture-only pseudo-CLI cases, weaker inventory checks, and obsolete source-text scans.
- Statistics: selected-root HTTP data assertions remain. Removed exact private scan-count instrumentation; the separate warm-cache performance proof stays.

The architecture review found no unique supported contract lost and required no source correction. The detailed per-file removal map and all removed titles were reviewed at /tmp/back706-removal-map.md.

Validation on macOS with Bun 1.3.14 and a fresh CLI bundle: all changed retained test files passed focused checks. The final existing full CI profile (--parallel=2 --isolate --timeout=10000 --max-concurrency=2) passed 2,877 tests with eight existing opt-in PTY skips and zero failures across 290 files. Typecheck, Biome (431 files), build, and diff checks passed. Full log: /tmp/back706-full.log.

An unchanged board partial-failure test failed once in the initial non-isolated focused batch. A single exact-command comparison on the original d2220ec tests passed, and the final isolated full run also passed. The cause remains unexplained; the regression test and its assertions are unchanged. Comparison receipt: /tmp/back706-baseline-receipt.json.

The archive/delete checkpoint 017db3b remains intact. Its only overlapping test path is mcp-server.test.ts: future integration should add task_delete to the retained factory inventory, without restoring the removed helper inventory.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed 91 redundant or misleading test cases, including six whole files and 2,055 net test lines. Retained essential domain, persistence, safety, platform, and public-interface coverage. Full local CI profile: 2,877 passed, eight existing skips, zero failures; typecheck, lint, and build pass. An earlier unchanged board-test failure remains documented and unexplained.
<!-- SECTION:FINAL_SUMMARY:END -->
