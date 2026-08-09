---
id: BACK-624
title: Make shared cross-branch task loading fast and incremental
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-09 23:11'
updated_date: '2026-08-09 23:16'
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
- [ ] #1 A cold shared-corpus load does not fetch, enumerate, or resolve the same branch tips redundantly within one load.
- [ ] #2 Repeated Web and MCP task reads reuse the initialized corpus and do not re-index unchanged branch tips.
- [ ] #3 When branch refs change, affected task results refresh while unchanged branch data is reused.
- [ ] #4 Local task and completed-task changes remain visible promptly without forcing a full cross-branch rebuild.
- [ ] #5 Remote refresh work is coalesced and time-bounded so an unavailable remote cannot stall task reads indefinitely.
- [ ] #6 Cross-branch task resolution, completed-task visibility, duplicate ambiguity handling, configuration changes, and project-root changes retain their current semantics.
- [ ] #7 Deterministic tests cover cold, warm, changed-ref, watcher, MCP, and Web loading paths without relying on wall-clock thresholds.
- [ ] #8 Before-and-after benchmark evidence records Git subprocess counts and elapsed time for representative cold and warm loads.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
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
Task creation itself attempted a full cross-branch fetch before rendering the result, confirming that common write paths still pay global corpus costs.
<!-- SECTION:NOTES:END -->
