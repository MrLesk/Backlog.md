---
id: BACK-535.4
title: Make server and process test teardown deterministic
status: Done
assignee:
  - '@test-hygiene-resources'
created_date: '2026-07-11 09:21'
updated_date: '2026-07-11 15:51'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: high
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace swallowed or incomplete shutdown in resource-owning tests after BACK-535.2. The complete 146-site test-infrastructure catch scan assigns these 24 swallowed cleanup/pre-clean sites to this task: src/test/mcp-task-complete.test.ts:42, src/test/worktree-refresh.test.ts:28, src/test/mcp-drafts.test.ts:44, src/test/mcp-task-type-filtering.test.ts:49, src/test/mcp-milestones.test.ts:69, src/test/mcp-stdio-exit.test.ts:184, src/test/build.test.ts:81, :88, :177, and :207, src/test/mcp-final-summary.test.ts:42, src/test/cli-board-integration.test.ts:15 and :58, src/test/board-command.test.ts:15, :75, :107, and :108, src/test/search-service.test.ts:70, src/test/mcp-refs-docs.test.ts:42, src/test/mcp-tasks.test.ts:48 and :1195, src/test/mcp-definition-of-done-defaults.test.ts:44, src/test/mcp-documents.test.ts:44, and src/test/content-store.test.ts:62.

The owned files are src/test/board-command.test.ts, src/test/build.test.ts, src/test/cli-board-integration.test.ts, src/test/config-watcher.test.ts, src/test/content-store.test.ts, src/test/mcp-definition-of-done-defaults.test.ts, src/test/mcp-documents.test.ts, src/test/mcp-drafts.test.ts, src/test/mcp-final-summary.test.ts, src/test/mcp-milestones.test.ts, src/test/mcp-refs-docs.test.ts, src/test/mcp-stdio-exit.test.ts, src/test/mcp-task-complete.test.ts, src/test/mcp-task-type-filtering.test.ts, src/test/mcp-tasks.test.ts, src/test/search-service.test.ts, and src/test/worktree-refresh.test.ts. Config-watcher has no swallowed catch in the current scan but remains owned because watcher shutdown must be proven deterministic.

Stop servers and watchers, close clients, streams, content stores, and search services, kill and await child processes, remove worktrees safely, then clean fixture directories without masking the primary test result. These sites and files are explicitly excluded from BACK-535.3. The complete distribution is 37 BACK-535.3 pre-clean, 59 BACK-535.3 filesystem teardown, 24 BACK-535.4 resource cleanup, 22 legitimate explicit sites, and four BACK-535.5 vacuous assertion sites.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every owned server, watcher, client, stream, subscription, and child process is deterministically released
- [x] #2 Shutdown failures remain visible and primary assertion failures remain diagnosable
- [x] #3 No arbitrary sleeps or timeout increases are used as lifecycle fixes
- [x] #4 Focused repeated stress and full cross-platform CI pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit the 17 owned resource-bearing test files and classify the 24 assigned swallowed cleanup sites.
2. Release resources in reverse acquisition order, await terminal process state, preserve primary failures, and remove arbitrary lifecycle sleeps without production changes.
3. Run repeated focused stress, full static/build/test gates, and independent specification and quality reviews.
4. Publish the bounded test-only PR and require exact-head Linux, macOS, and Windows CI before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter L2 brief: this is test-only lifecycle work across MCP servers/clients, stdio processes, browser processes, config watchers, ContentStore/SearchService, board background operations, and Git worktrees. Follow resource acquisition in each file and release in reverse order before filesystem cleanup. Reuse existing stop/close/dispose/kill/exited/cancel APIs; attach rejection handlers immediately, await terminal state, and preserve a primary test failure when shutdown also fails. Do not add sleeps/timeouts as fixes, change production code, touch BACK-535.5 vacuous sites, or broaden the 17 owned files. Risks: stop methods may not be idempotent, abort may not drain an in-flight promise, process kill without exited can leak, worktree removal can race Git, and a teardown failure can mask an assertion. No new identifiers should be introduced without following local resource names.

Integrated audit after implementation: all 24 owned swallowed cleanup/pre-clean sites were removed. The remaining test catch inventory is 39 sites: 22 previously classified legitimate catches, four vacuous assertions reserved for BACK-535.5, and 13 new fail-visible catches used only to preserve or aggregate primary and cleanup failures (build 3, mcp-stdio-exit 4, mcp-tasks 4, worktree-refresh 2). No production files changed.

Independent spec review found and corrected two lifecycle gaps before freeze: board fixtures now guard Core disposal when setup fails before construction, and the compiled MCP smoke test captures and awaits the transport-owned child terminal event alongside client.close(). Corrected-head validation: two integrated runs passed 170/170 each; focused corrected paths passed 9/9; full suite passed 1666 with two intentional interactive-TUI skips; bunx tsc --noEmit, Biome over 323 files, bun run build, and git diff --check passed. Exact-head cross-platform CI remains required before AC4/finalization.

Scope/evidence correction (supersedes the earlier 17-file/39-catch statement): the two process-close implementations converged, so src/test/test-utils.ts is an intentional 18th test-infrastructure file used to keep close/error/kill/listener semantics single-sourced. The current catch inventory is 40 sites: 26 baseline sites (22 legitimate plus four reserved for BACK-535.5) and 14 new fail-visible error-preservation sites, including the shared helper kill-error capture.

Final local lifecycle candidate passed focused shared-helper/build/stdio coverage 6/6, integrated coverage 173/173 twice, typecheck, Biome over 323 files, build, and diff-check. The exact full suite then reported 1665 pass, two intentional interactive-TUI skips, and one failure: the unchanged monolithic CLI packaging test hit Bun’s 5000ms outer timeout under full-suite contention for the second time. Isolated packaging passed repeatedly around 2-3.3s. Per maintainer coordination, do not alter packaging/workflows or mark AC4 complete in BACK-535.4; BACK-535.6 owns that repeated build/CI duplication and timeout. Rebase this frozen lifecycle commit after BACK-535.6 merges, then rerun exact integrated/full/static and independent reviews before PR/finalization.

Post-BACK-535.6/BACK-535.7 reconciliation (supersedes earlier build-inclusive counts): BACK-535.6 removed src/test/build.test.ts and its four assigned cleanup sites as part of the accepted compiled-smoke consolidation. BACK-535.4 therefore owns the remaining 20 original resource-cleanup sites plus config-watcher lifecycle verification across 16 original test files, with src/test/test-utils.ts as the single shared close/error/kill helper file (17 changed test files total). Current catch inventory is 35: 24 baseline sites (20 legitimate explicit catches and four BACK-535.5 vacuous assertions) plus 11 new fail-visible error-preservation sites (mcp-stdio-exit 4, mcp-tasks 4, worktree-refresh 2, shared child-close helper 1). No production, CI, or BACK-535.5 files changed.

Final rebase verification on unified-main 1f617b6: integrated lifecycle set passed 172/172 twice (30.72s and 30.01s); exact shared full command `bun test --isolate --timeout=10000 --max-concurrency=4` passed 1,665 with two intentional interactive-TUI skips across 188 files in 182.07s; bunx tsc --noEmit, Biome over 324 files, bun run build, and git diff --check passed. AC4 remains open pending this exact repair head in unified Linux/macOS/Windows CI.

Final stage-1 review found and corrected one shutdown-observation race: the raw MCP stdio test had attached the shared close helper at spawn, which also started its one-second graceful timer before shutdown was requested. The shared helper now observes close/error immediately but exposes an idempotent startTimeout operation; the raw test activates it only after stdin closes or cleanup begins, while the transport test activates it immediately before client.close. This preserves the existing four-second startup allowance and keeps bounded shutdown diagnostics separate from tested process lifetime.

Post-correction exact verification: focused stdio/helper tests passed 5/5; integrated lifecycle set passed 172/172 twice (27.44s and 27.16s); shared full command passed 1,665 with two intentional skips across 188 files in 170.39s; typecheck, Biome over 324 files, build, and diff checks passed. Unified-main operational baseline is green in CI run 29157797520 and CodeQL run 29157797240. AC4 remains open for this repair head.

Exact implementation-head PR verification at 446e47d: CI run 29158369735 passed full unit jobs on Ubuntu (3m53s), macOS (3m53s), and Windows (9m49s), plus compiled build/smoke on Ubuntu (20s), macOS (29s), and Windows (1m32s). JUnit artifacts were non-empty: Ubuntu 66,166 bytes, macOS 66,955 bytes, Windows 65,505 bytes. CodeQL run 29158369248 passed both JavaScript/TypeScript and Actions analyses. Both independent final reviews approved the exact diff with no blockers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made resource-owning tests deterministic and fail-visible: MCP servers/clients, watchers, stores, child processes, and Git worktrees now release before fixture deletion; cleanup failures aggregate without hiding primary assertions. Shared child-close observation captures events immediately while bounded shutdown timers begin only when cleanup starts. Verified with repeated 172-test lifecycle stress, the 1,665-test full suite, static/build gates, independent specification and quality reviews, and unified Linux/macOS/Windows CI, compiled smoke, JUnit artifacts, and CodeQL.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
