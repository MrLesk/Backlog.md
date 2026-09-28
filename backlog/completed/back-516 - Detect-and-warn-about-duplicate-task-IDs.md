---
id: BACK-516
title: Human-first duplicate task ID recovery
status: Done
assignee:
  - '@pr749-takeover'
created_date: '2026-05-03 20:54'
updated_date: '2026-07-10 18:30'
labels:
  - enhancement
  - ux
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/711'
modified_files:
  - backlog/tasks/back-516 - Detect-and-warn-about-duplicate-task-IDs.md
  - src/cli.ts
  - src/core/backlog.ts
  - src/core/duplicate-task-repair.ts
  - src/file-system/operations.ts
  - src/mcp/errors/mcp-errors.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/test/atomic-task-create.test.ts
  - src/test/cli-doctor.test.ts
  - src/test/cli.test.ts
  - src/test/core.test.ts
  - src/test/duplicate-detection.test.ts
  - src/test/duplicate-task-repair.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/prefix-config.test.ts
  - src/test/server-duplicate-repair.test.ts
  - src/test/server-tasks-spa-fallback.test.ts
  - src/test/task-path.test.ts
  - src/test/unified-view-loading.test.ts
  - src/test/web-duplicate-id-repair.test.tsx
  - src/test/web-task-detail-deeplink.test.tsx
  - src/ui/unified-view.ts
  - src/utils/duplicate-detection.ts
  - src/utils/prefix-config.ts
  - src/utils/task-id.ts
  - src/utils/task-path.ts
  - src/web/App.tsx
  - src/web/components/DuplicateIdRepairModal.tsx
  - src/web/components/DuplicateIdWarning.tsx
  - src/web/components/Layout.tsx
  - src/web/components/Modal.tsx
  - src/web/lib/api.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Duplicate task IDs can arise after merges or from equivalent numeric spellings such as TASK-1 and TASK-01. Current behavior can silently collapse tasks, and the recovery flow must work for humans without assuming an AI agent.

Implement a human-first, CLI-canonical diagnosis and repair workflow. The CLI detects collisions anywhere a view could collapse them, fails closed for ambiguous ID-based operations, previews deterministic file-level repairs, and safely applies an explicitly confirmed repair. The browser UI exposes the same shared capability with best-effort usability at 390px. MCP remains an adapter rather than the product-defining workflow. Archived IDs remain intentionally reusable. This recovery relates to GitHub issue #711 but deliberately stops at repair; collision-prevention or random-ID policy remains separate scope.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI diagnosis reports 2-way and 3-way collision groups with exact paths, including active+completed and canonical zero-padding equivalence; archived-only reuse is not flagged.
- [x] #2 Ambiguous ID-based reads and mutations fail closed with actionable exact-path diagnostics instead of choosing one file.
- [x] #3 Plain CLI list, search, and board output visibly diagnose collisions rather than silently hiding them.
- [x] #4 A human can preview and explicitly confirm a deterministic repair that updates filename and frontmatter atomically, preserves task content, and reports references requiring manual review.
- [x] #5 Noninteractive repair exists only where deterministic and safe, with no guessing of ambiguous references or cross-branch files.
- [x] #6 Browser Web uses shared diagnosis and repair semantics, removes AI-agent copy or prompt instructions, preserves route and focus behavior, and remains usable at desktop widths and best-effort 390px.
- [x] #7 Shared behavior is covered across utility, core, CLI, server, MCP, TUI, and Web boundaries, including huge, padded, dotted, legacy, stale-plan, lifecycle, and no-clobber rollback cases.
- [x] #8 The recovery implementation relates to issue #711 without closing it or adding random or collision-prevention ID policy.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Normally merge exact main c18bc44e and preserve main-authoritative task-type API, App latest-wins loading, query state, single-flight edits, and two-row board behavior while composing duplicate recovery.
2. Add deterministic red tests for an external writer recreating an original source after backup and externally editing or replacing an installed target before a later failure.
3. Make rollback ownership-safe: restore backups without replacement, quarantine and identify installed targets before deleting only transaction-owned content, preserve external content and recovery artifacts on conflicts, and return actionable paths.
4. Verify successful repairs and no-race rollback remove all transaction artifacts while source/target conflicts retain explicit recoverable state.
5. Run huge, legacy, transaction, concurrency, and latest-main integration tests, then the full suite, TypeScript, Biome, build, diff-check, and compiled CLI smoke.
6. Update task evidence and refreeze locally for independent review without push, merge, or public edit; keep #711 related and open.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refreeze evidence (2026-07-10)

Integrated exact main c18bc44e by a normal merge. The composed result preserves main-authoritative task-type API behavior, App latest-request-wins loading, URL query state, single-flight type edits, and two-row board controls while adding shared duplicate diagnosis and repair.

Independent review of freeze 4e271fc found a P1 rollback ownership defect. Deterministic red tests reproduced both losses: a recreated original source was overwritten after source-to-backup rename, and an externally edited installed target was deleted after a later failure. Rollback now records each staged file identity as device, inode, and byte-level SHA-256; moves installed targets into unique same-directory recovery storage before checking identity; deletes only transaction-owned content; restores changed targets and original backups with hard-link no-replace semantics; preserves conflicting content and backup paths; and returns actionable recovery errors. The source-winner test keeps external source bytes plus the original .bak, and the target-edit test keeps external target bytes at the original target. Successful and ordinary rollback paths leave no transaction artifacts.

Validation is clean: the composed focused matrix passes 248 tests with 1429 assertions; the authoritative suite passes 1643 tests with 2 intentional interactive skips, 0 failures, and 6700 assertions across 189 files. TypeScript, Biome over 324 files, build, and diff-check pass. Compiled CLI preview reports one group across three files, deterministic TASK-2 and TASK-3 changes, and two manual references. Compiled Chrome QA passes at 1920px and 390px with the task-type filter and two-row controls intact, correct Cancel then Repair focus, no document or dialog horizontal overflow, visible confirmation actions and overlay, zero console warnings or errors, successful repair refresh, TASK-1/TASK-2/TASK-3 post-doctor verification, unchanged ambiguous references, and no backlog-doctor artifacts.

The local merge commit remains intentionally unpushed pending independent code, specification, and UX review. Scope remains recovery-only; PR relationship wording must be neutral and must not close #711.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented human-first duplicate task ID diagnosis and deterministic repair across CLI, core, MCP, server, TUI, and Web, then hardened rollback ownership after independent P1 review. Concurrently recreated sources and changed installed targets are preserved with explicit recovery paths instead of overwritten or deleted. Verified on exact main c18bc44e by 1643 passing tests, TypeScript, Biome, build, compiled CLI smoke, and desktop/390px Chrome repair QA with no console errors.
<!-- SECTION:FINAL_SUMMARY:END -->
