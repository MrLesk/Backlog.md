---
id: BACK-623
title: Make common task commands avoid unnecessary cross-branch work
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 22:02'
updated_date: '2026-08-09 22:24'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Common single-task commands currently load the cross-branch corpus and may fetch origin before resolving a local task. On this repository that makes task view and task edit take tens of seconds or hang. Task list is also slower than expected. Preserve fail-closed identity semantics while making local single-task operations bypass cross-branch work and removing avoidable work from task listing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task view and the task shorthand resolve and render a unique local task without fetching remotes or enumerating active branches
- [x] #2 backlog task edit resolves and updates a unique local task without fetching remotes or enumerating active branches
- [x] #3 Single-task commands still fail closed for ambiguous local task identities and report missing tasks correctly
- [x] #4 backlog task list performs only the remote and cross-branch work required by configuration without duplicate refreshes or redundant corpus loads
- [x] #5 Focused automated tests assert the Git-operation boundaries for task view, shorthand, edit, and list
- [x] #6 Before-and-after timings on a representative repository demonstrate faster task view, task edit, and task list behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add working-copy active/completed identity resolution that preserves canonical ambiguity without branch loading.
2. Make includeCrossBranch:false load and search local tasks directly, and route CLI view, shorthand, and edit through that path.
3. Preserve the atomic in-lock reread but make it local, and remove the redundant interactive-list corpus load.
4. Add regression tests proving fetch and branch readers are not called while existing cross-branch Core behavior remains.
5. Run focused tests, typecheck, lint, build, and before/after command timings.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnosis: v1.49.0 routed local view/edit through the cross-branch ContentStore; v1.50.0 added a necessary in-lock reread that currently repeats that full scan. includeCrossBranch:false has only filtered results after loading. Backlog lock directories were empty and task locks fail fast; unbounded fetch plus repeated branch indexing is the dominant delay.

Implemented a working-copy active/completed identity resolver for local reads and mutations; includeCrossBranch:false now loads and searches local tasks before ContentStore initialization. CLI view, shorthand, edit, and parent filtering use the local scope; the atomic in-lock reread remains. Removed the interactive list's redundant full load. Consolidated padded/dotted task search variants into one shared helper so local and global search remain aligned.

Validation passed: TypeScript, Biome over 371 files, build, and 178 focused/control tests covering local Git tripwires, CLI branch-only behavior, list/search, custom IDs, task views, Core identity behavior, atomic locks, board/worktree refresh, and cross-branch ContentStore preservation. A broad ContentStore batch also exposed unrelated temporary-worktree watcher timeouts; the relevant cross-branch invariant passed alone.

Same-checkout benchmark, v1.50 to fixed binary: task view 4.42s to 0.85s; task list 4.15s to 0.21s; no-op task edit 12.19s to 0.42s. The old commands attempted remote fetches; the fixed commands did not.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made local task list, view, shorthand, and edit bypass cross-branch fetching and branch enumeration while preserving local ambiguity checks and atomic edit locking. Global cross-branch Core behavior remains available for browser/MCP surfaces. Verified with structural Git-boundary tests, CLI branch-only tests, 178 focused/control tests, typecheck, lint, build, and same-checkout timings.
<!-- SECTION:FINAL_SUMMARY:END -->
