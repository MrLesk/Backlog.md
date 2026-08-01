---
id: BACK-557
title: Treat same-path cross-branch task versions as one identity
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-08-01 10:26'
labels:
  - browser
  - git
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/818'
  - 'https://github.com/MrLesk/Backlog.md/issues/783'
type: bug
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-branch task loading currently folds display selection, lifecycle state, collision detection, and ID occupancy independently. Treat each task identity as one canonical ID plus one normalized repository-relative logical task path. Versions at the same path resolve as one identity with working-copy authority, while live identities at distinct paths remain ambiguous and fail closed across CLI, MCP, browser, statistics, lifecycle, and allocation surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Same canonical ID at the same normalized path across local and branch versions resolves as one identity, with the working copy authoritative.
- [ ] #2 The same canonical ID at distinct local paths fails closed.
- [ ] #3 Branch-only variants of the same canonical ID at distinct paths fail closed.
- [ ] #4 An active local identity plus a completed identity at a distinct path fails closed.
- [ ] #5 An active working-copy record plus an archived version at the same logical path remains active and keeps the ID occupied.
- [ ] #6 An identity whose variants are all archived is hidden and its ID is reusable.
- [ ] #7 Equal timestamps for active and archived records resolve deterministically, remain scan-order independent, and cannot free an ID while a live record exists.
- [ ] #8 includeCompleted preserves active canonical state and agrees with All Tasks and task detail resolution.
- [ ] #9 Padded IDs at distinct paths fail closed consistently across supported surfaces.
- [ ] #10 Allocation compares IDs without padding while preserving the configured or existing output spelling.
- [ ] #11 Core getTask applies collision safety without requiring a stale prior load.
- [ ] #12 Nested project and backlog directories normalize local and Git paths into one repository-relative logical path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add RED regressions on exact PR head 5026e3bb for lifecycle-hidden collisions, equal-time active versus archive allocation, and includeCompleted active versus completed collisions; map the remaining bounded matrix to existing or new public-surface tests.
2. Add one internal task identity index keyed by canonical ID and normalized repository-relative logical task path. Each record carries lifecycle state, provenance, timestamp, working-copy authority, and optional hydrated task content; define deterministic tie rules and monotone occupancy there.
3. Adapt branch record collection so hydrated versions stay attached to the indexed path, then replace the separate canonical maps and lifecycle filters in loadTasks, statistics loading, allocation, direct Core getTask, and active-branch collision checks with projections from the shared index.
4. Route browser task detail through Core identity resolution and preserve local upsert behavior; verify MCP reads and mutations use the same Core result without weakening duplicate protection.
5. Complete the 12-case proof matrix, including padded IDs, all-archived reuse, direct getTask, and a nested project/custom backlog path; rebase safely onto current origin/main and preserve BACK-560 loopback behavior.
6. Run focused identity, Core, MCP, server, Web, lifecycle, allocation, and remote suites, then full bun test, TypeScript, Biome, and git diff checks. Simplify duplicate folds, finalize BACK-557 through the CLI, obtain one fresh exact-head review, and only then publish the corrected regular PR head.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reopened after automatic review on 5026e3bb found three root-cause symptoms: lifecycle filtering can hide a collision before the guard runs, equal active/archive timestamps depend on scan order and can free a live ID, and includeCompleted can replace active canonical state. The correction is re-scoped to one shared identity index rather than another set of per-surface conditions.

RED evidence on exact PR head 5026e3bb: focused Core run executed three new public-API regressions and all failed for the intended reasons. Lifecycle-hidden collision resolved the local task instead of throwing AmbiguousTaskIdError; equal-time active/archive branch records generated BACK-1 instead of BACK-2; includeCompleted returned no distinct active/completed identities instead of preserving both paths.

GREEN evidence before integration: 197 focused tests pass across the shared index, Core identity/lifecycle/allocation cases, MCP/statistics/board/unified views, and browser/server/Web/search routes. bunx tsc --noEmit, bun run check ., and git diff --check are clean. The simplification pass removed the former per-surface canonical maps, lifecycle filters, and duplicate branch-collision helper in favor of TaskIdentityIndex projections.
<!-- SECTION:NOTES:END -->
