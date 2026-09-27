---
id: BACK-557
title: Treat same-path cross-branch task versions as one identity
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:11'
updated_date: '2026-08-01 10:57'
labels:
  - browser
  - git
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/818'
  - 'https://github.com/MrLesk/Backlog.md/issues/783'
modified_files:
  - src/core/backlog.ts
  - src/core/task-identity-index.ts
  - src/core/task-loader.ts
  - src/git/operations.ts
  - src/server/index.ts
  - src/test/core.test.ts
  - src/test/local-branch-tasks.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
  - src/test/task-identity-index.test.ts
  - src/test/test-utils.ts
type: bug
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-branch task loading currently folds display selection, lifecycle state, collision detection, and ID occupancy independently. Treat each task identity as one canonical ID plus one normalized repository-relative logical task path. Versions at the same path resolve as one identity with working-copy authority, while live identities at distinct paths remain ambiguous and fail closed across CLI, MCP, browser, statistics, lifecycle, and allocation surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Same canonical ID at the same normalized path across local and branch versions resolves as one identity, with the working copy authoritative.
- [x] #2 The same canonical ID at distinct local paths fails closed.
- [x] #3 Branch-only variants of the same canonical ID at distinct paths fail closed.
- [x] #4 An active local identity plus a completed identity at a distinct path fails closed.
- [x] #5 An active working-copy record plus an archived version at the same logical path remains active and keeps the ID occupied.
- [x] #6 An identity whose variants are all archived is hidden and its ID is reusable.
- [x] #7 Equal timestamps for active and archived records resolve deterministically, remain scan-order independent, and cannot free an ID while a live record exists.
- [x] #8 includeCompleted preserves active canonical state and agrees with All Tasks and task detail resolution.
- [x] #9 Padded IDs at distinct paths fail closed consistently across supported surfaces.
- [x] #10 Allocation compares IDs without padding while preserving the configured or existing output spelling.
- [x] #11 Core getTask applies collision safety without requiring a stale prior load.
- [x] #12 Nested project and backlog directories normalize local and Git paths into one repository-relative logical path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

Final exact-head verification on 27c1cc5d after rebasing onto origin/main deedb4e0: bun test passed 1,805 tests with 4 documented interactive TUI skips and 0 failures across 202 files (7,647 assertions); bunx tsc --noEmit passed; bun run check . checked 342 files with no fixes; git diff --check passed. A first full run exposed only two established progress-callback compatibility expectations; preserving the branch-scan message under the original checkActiveBranches gate made the isolated board-loading file 10/10 green before the clean full rerun.

Fresh exact-head independent review cycle 1 requested changes before push. P1: Core.getTask/MCP detail and mutation reads can reuse a stale task identity index after branch refs change, unlike the browser path that explicitly refreshes. P2: branch hydration still chooses one record per raw ID spelling, so includeCompleted/statistics can omit other branch-only logical-path identities with the same spelling. Reopened to add RED coverage and fix freshness plus per-logical-path hydration centrally.

Review cycle 1 RED/GREEN: on 0e284a8e, three focused regressions all failed—long-lived Core getTask resolved after a late branch collision, MCP task_edit mutated the local task after the same late collision, and same-spelling branch-only active/completed identities returned only the completed task. Core freshness is now centralized in getTask with coalesced fingerprint refresh; loadTaskById, detail views, updates, archive, complete, and demote validate through that result. Branch hydration supplements the prior display winner with one deterministic candidate per canonical ID plus logical path, using shared lifecycle-path normalization. The three regressions pass, the broader Core/MCP/server/board/branch/allocation/index suite passes 135/135, the demote/freshness subset passes 4/4, and tsc, Biome (342 files), and diff-check are clean.

Final review-cycle-1 verification on 571fc63f: bun test passed 1,808 tests with 4 documented interactive TUI skips and 0 failures across 202 files (7,657 assertions); bunx tsc --noEmit passed; bun run check . checked 342 files with no fixes; git diff --check passed. origin/main remains deedb4e0, the integration base used by this branch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Introduced one shared task identity index keyed by padding-insensitive canonical ID plus normalized repository-relative logical path. Local, branch, worktree, completed, and archive records share deterministic working-copy/lifecycle/display rules; distinct live paths fail closed; any live variant occupies the ID and all-archived identities are reusable. Core freshness is checked at the central resolver for long-lived CLI, MCP, and browser reads/mutations, while branch hydration preserves one candidate per logical identity so includeCompleted and statistics cannot omit same-spelling distinct paths. Regression coverage spans late ref changes, branch-only and padded collisions, lifecycle shadows, equal timestamps, direct reads, mutation safety, allocation, and nested custom backlog paths.
<!-- SECTION:FINAL_SUMMARY:END -->
