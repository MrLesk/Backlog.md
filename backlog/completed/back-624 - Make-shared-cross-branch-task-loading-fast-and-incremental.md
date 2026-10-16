---
id: BACK-624
title: Make shared cross-branch task loading fast and incremental
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 23:11'
updated_date: '2026-08-10 06:24'
labels:
  - core
  - performance
  - mcp
  - web
dependencies:
  - BACK-623
priority: high
type: bug
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-branch task reads currently fetch, enumerate, index, hydrate, and parse much of the same Git corpus repeatedly. This makes browser startup, MCP task operations, and any global task view slow in repositories with many active branches. Make the shared loader reuse stable state and bound remote work while preserving local-first behavior, cross-branch freshness, identity resolution, and filesystem-only operation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A cold shared-corpus load does not fetch, enumerate, or resolve the same branch tips redundantly within one load.
- [x] #2 Repeated Web and MCP task reads reuse the initialized corpus and do not re-index unchanged branch tips.
- [x] #3 When branch refs change, affected task results refresh while unchanged branch data is reused.
- [x] #4 Local task and completed-task changes remain visible promptly without forcing a full cross-branch rebuild.
- [x] #5 Remote refresh work is coalesced and time-bounded so an unavailable remote cannot stall task reads indefinitely.
- [x] #6 Cross-branch task resolution, completed-task visibility, duplicate ambiguity handling, configuration changes, and project-root changes retain their current semantics.
- [x] #7 Deterministic tests cover cold, warm, changed-ref, watcher, MCP, and Web loading paths without relying on wall-clock thresholds.
- [x] #8 Before-and-after benchmark evidence records Git subprocess counts and elapsed time for representative cold and warm loads.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add deterministic semantic-work probes and a non-gating benchmark for cold and warm Core, MCP, and Web task loads.
2. Cache parsed working-copy task files by exact content with defensive copies so repeated active/completed scans remain immediately correct but avoid reparsing unchanged Markdown.
3. Refactor cross-branch loading to fetch once, capture one immutable branch-tip snapshot, reuse indexes and hydrated payloads for unchanged commits, and bound Git fetch duration.
4. Route long-lived MCP and Web task consumers, including task search and statistics, through the shared task corpus instead of independent reloads while keeping the one-shot CLI local fast path.
5. Verify watcher/root/config invalidation, active/completed ambiguity, branch movement, concurrent refresh, and cross-surface result parity; record before-and-after process counts and timings.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared immutable branch-tip snapshot and incremental BranchTaskLoader for Core and ContentStore. Cross-branch reads fetch once, validate structured before/after tip snapshots, pin reads to commit SHAs, deduplicate branch aliases and commit:path hydration, and reuse tree, history, and task payload work across unchanged generations. Git repository detection and fetch calls are coalesced; fetches are noninteractive and hard-bounded with descendant-process cleanup.

Working-copy active and completed Markdown uses an exact-content parse cache with defensive clones, bounded parallel reads, and path/root generations. Warm reads reconcile local changes without re-indexing branches. MCP task_search uses the local active+completed identity corpus without Git. Web task list, task search, and statistics reuse the shared corpus; document/decision-only searches skip task refresh. Root, config, watcher, completed-task, ambiguity, branch-movement, mutation, and timeout semantics have deterministic regressions.

Correctness-gated benchmark: 80 active, 20 completed, 6 branches x 12 tasks, 3 samples. Core cold improved 534.49 ms / 394 Git processes to 183.91 ms / 76; Core warm 554.16 ms / 394 to 27.19 ms / 3. MCP search cold 531.86 ms / 394 to 14.00 ms / 0; warm 530.65 ms / 394 to 3.99 ms / 0. Web list cold 582.27 ms / 395 to 185.03 ms / 76. Web warm changed from 7.71 ms / 1 to 16.00 ms / 1 because it now performs exact local reconciliation for missed watcher events while still doing no branch re-indexing. Every sample checks exact task counts, task IDs, required and forbidden sentinels, and stable digests.

Final race and recovery review added logical backlog-root guards, joined-refresh rechecks, generation-safe ContentStore/SearchService acquisition, duplicate-preserving version-aware local reconciliation, hidden completed lifecycle suppression, cached branch fallback hydration, and retryable partial branch generations without malformed-content hot loops. Final benchmark on the verified tree: Core 189.8 ms / 76 Git cold and 27.7 ms / 3 warm; MCP search 13.8 ms / 0 cold and 3.8 ms / 0 warm; Web list 185.3 ms / 76 cold and 16.9 ms / 1 warm. Exact counts, IDs, required/forbidden sentinels, and digests passed for every sample.

Fix round after review: standalone corpus loads no longer advance shared cross-branch freshness state. Only the ContentStore corpus loader passes publishSharedState, so a task-ID allocation (or a statistics/TUI load) between a branch-tip move and the next read can no longer publish the moved fingerprint without installing the matching corpus, which previously froze stale cross-branch data in watcher-backed web/MCP processes until the next ref or config change. Task-ID allocation now sets forceRemoteRefresh, bypassing the 60s coalesced remote-refresh window that ordinary reads keep, so allocation is at least as fresh as it was before this task (the 10s fetch bound and offline degradation are unchanged) and two clones cannot hand out the same numeric ID inside that window. Cancellation is checked before the remote refresh so an aborted TUI view switch no longer waits out the fetch timeout, and allocation reuses the completed tasks its own corpus load already listed instead of listing them a second time. Three regression tests in src/test/core-task-corpus-regressions.test.ts pin each behaviour and were confirmed to fail on the pre-fix source.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made task loading incremental and shared across CLI/Core, MCP, and Web. Cold cross-branch reads now use one bounded fetch and immutable tip generation; warm reads reuse branch indexes and hydrated payloads while cheaply reconciling exact working-copy content. MCP task search is Git-free, Web search/statistics reuse the shared corpus, and task creation/duplicate checks use the same loader. Concurrency and recovery paths preserve logical roots, newer publications, local completions, duplicate ambiguity, branch fallbacks, and transient retry behavior. Added a correctness-gated benchmark and deterministic coverage for cold, warm, changed-ref, watcher, root/config, ambiguity, completed-task, and timeout paths. Validation: 2,236 tests passed with 6 interactive skips and 0 failures; TypeScript, full Biome, build, diff checks, and the correctness-gated benchmark pass.
<!-- SECTION:FINAL_SUMMARY:END -->
