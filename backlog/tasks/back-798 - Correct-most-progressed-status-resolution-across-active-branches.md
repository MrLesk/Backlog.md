---
id: BACK-798
title: Correct most-progressed status resolution across active branches
status: Done
assignee:
  - '@codex'
created_date: '2026-10-28T23:46:00Z'
updated_date: '2026-10-29T07:23:00Z'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1024'
  - 'https://github.com/MrLesk/Backlog.md/issues/1141'
  - 'https://github.com/MrLesk/Backlog.md/pull/1143'
  - 'https://github.com/MrLesk/Backlog.md/pull/1144'
  - src/core/task-loader.ts
  - src/core/task-identity-index.ts
  - src/core/content-store.ts
  - src/git/operations.ts
modified_files:
  - src/test/task-identity-index.test.ts
  - src/test/core-task-corpus-regressions.test.ts
  - src/test/core.test.ts
  - src/core/task-identity-index.ts
  - src/core/task-loader.ts
  - src/git/operations.ts
  - src/test/test-utils.ts
  - src/test/branch-task-loader-resilience.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
  - scripts/benchmark-task-loading.ts
  - src/test/mcp-tasks.test.ts
priority: high
type: bug
ordinal: 404000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review issues #1024 and #1141 and PRs #1143/#1144 together as the bounded branch-status correction requested by Alex. Current cross-branch reads prefer a local copy before comparing status and skip older branch content before its status is known. The two contributor PRs fix the reported examples but require maintainer review: their task IDs already belong to other work on main, identical-copy skipping leaves warm sessions with stale status choices, and nested project paths fail to hydrate. Keep the larger shared-metadata design in BACK-760 and the separate MCP local-read change in BACK-625 outside this correction. Alex approved the plan and the winning branch version remaining read-only in the browser on 2026-10-29.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Under most_progressed, cross-branch reads show the furthest configured status for the same task identity even when a local edit or another branch copy is newer; equal statuses prefer the working copy.
- [x] #2 A local edit after a branch copy was initially identical produces the same selected status in an existing session and a fresh session.
- [x] #3 Branch task loading works from nested projects and custom backlog paths while preserving identity ambiguity and archive rules.
- [x] #4 Local-only CLI reads and mutation targets remain local, and the approved cross-branch display behavior is covered by regressions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved by Alex on 2026-10-29, including the winning branch version remaining read-only in the browser.
1. Keep this correction inside the existing cross-branch read model. Under most_progressed, compare configured status rank before preferring the working copy; keep the local copy on equal status. A winning branch version keeps its branch source and existing read-only UI behavior. Plain CLI task reads and mutation targets stay local. Leave most_recent and the larger BACK-760 sharing model unchanged.
2. Reuse the branch loader and identity index. Read each relevant distinct branch version regardless of the local update date or a newer less-progressed branch. Retain enough immutable branch data for later local edits to produce the same result in a warm session and a fresh one; do not discard a branch candidate merely because it initially matches the local file. Keep caching bounded to retained branch snapshots.
3. Normalize Git read paths for nested projects and custom backlog directories. Preserve lifecycle selection, ambiguity detection and occupied IDs. Adopt only reviewed source changes from PRs #1143/#1144; do not import their conflicting BACK-790/BACK-791 records.
4. Add focused regressions for both issue examples, local/remote branch competition, warm reads after local edits, nested paths and local mutation targeting. Check relevant load costs, types and Biome. Obtain required simplicity/complexity reviews and Codex PR review, address supported findings, and merge only after required checks pass and no relevant Codex code comments remain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the approved correction using the existing branch loader and identity index. Under most_progressed, configured status order is compared before working-copy preference; equal statuses still select the working copy. The loader reads each distinct branch version without using dates to guess its status. Git blob IDs share content reads across branches and commits. Initially identical branch versions remain available after local edits, and the existing snapshot retention bounds the cache. No new dependencies or state layer were added.

Tree listings, history paths and content reads now use the same project-relative paths, including nested projects with a custom backlog directory. Lifecycle/ambiguity resolution and local-only mutation resolution remain with their existing owners. The most_recent strategy is unchanged.

Reviewed PR #1143 at 7cfb5eef and #1144 at 6a73504b against main 1d732cb5. Their combined source changes fix the reported examples but skip initially identical branch payloads: changing local In Progress to To Do then gives different warm and fresh results. Their nested-project read also fails. These reproduced cases are covered in the final correction. Their BACK-790/BACK-791 records were not imported because those IDs already identify unrelated tasks on main. The separate BACK-760 shared-metadata model and BACK-625 local-read scope remain outside this fix.

Regression evidence: before implementation, five checks failed for working-copy precedence, newer local timestamps, warm/fresh disagreement and nested branch loading. The same focused regression selection then passed (9 tests). The nine-file focused suite covered identity, shared loading, loader failures, Core, native Git corpus changes, HTTP, MCP local-only tripwires, Git and CLI behavior. One mock incorrectly gave identical content different blob IDs; correcting the fixture preserved the deterministic-branch assertion and all 28 loader tests passed. After review clarifications, all 55 loader/HTTP tests passed. TypeScript passed for 558 files; Biome passed for 479 files. Local server/watcher checks ran with the access they require.

Manual browser verification used an isolated repository: main held To Do, feature-progress held In Progress. The board showed In Progress with the feature-progress branch label. The detail view showed the read-only branch notice and disabled title/status/type/priority/milestone controls. The fixture and server were removed afterward. Native Core coverage proves local-only reads and updates still use the working copy.

The existing loading benchmark used 240 local tasks, 20 archived tasks, 12 mirrored local/remote branches, 6 changed or branch-only tasks per branch and 2 samples. All result/parity checks passed. Baseline versus final median: Core cold 214.37 -> 520.72 ms and web cold 222.46 -> 546.24 ms (88 -> 364 Git processes). Warm Core 36.22 -> 38.30 ms (3 processes), warm web 35.62 -> 36.57 ms (1 process), MCP cold local search 26.61 -> 24.16 ms (0 processes). The cold increase comes from retaining immutable versions that may become relevant after local edits. These fixture measurements are not a scale guarantee; broader loading optimization is outside this correction.

Cold simplicity review found no blocking issues or unnecessary structural complexity. Applied its two clarity suggestions: hydration inputs are called candidates, and the HTTP regression describes the winning branch version as read-only. The agent's specification and quality review confirmed the four acceptance criteria, unchanged local mutation targeting and bounded scope. The separate full-context complexity review also found no blocking findings or useful structural simplification. Required CI and Codex PR review remain the merge gates.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-10-29T07:09:00Z

---

Alex approved the BACK-798 plan on 2026-10-29 (Europe/Vienna), including keeping the winning branch version read-only in the browser. Implementation, checks, review fixes and merge are authorized; merge remains gated on passing checks and no relevant Codex review comments.

---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected most_progressed selection across active branches, including newer local edits and newer less-progressed remote copies. Equal statuses keep the working copy. Initially identical branch versions remain available after local edits, and nested/custom backlog paths load correctly. Winning branch versions retain their browser read-only state; local-only reads and mutations stay local.

Verified the reproduced failures, focused regression suites, TypeScript, Biome and the browser flow. Both required independent reviews found no blocking findings. The PR remains gated on required CI and relevant Codex review findings before merge.

The benchmark shows more work on the first cross-branch load (Core median 214 -> 521 ms in the recorded fixture); subsequent reads remain comparable (36 -> 38 ms). Blob caching avoids repeated content reads across unchanged branch versions.
<!-- SECTION:FINAL_SUMMARY:END -->
