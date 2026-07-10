---
id: BACK-516
title: Human-first duplicate task ID recovery
status: In Progress
assignee:
  - '@pr749-takeover'
created_date: '2026-05-03 20:54'
updated_date: '2026-07-10 17:17'
labels:
  - enhancement
  - ux
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/711'
modified_files:
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
1. Merge current main 2b6b2adb normally and resolve conflicts by preserving main task identity, branch freshness, config-root lifecycle, route history, and modal focus semantics.
2. Compose duplicate diagnosis and repair with the shared task-id resolver so large numeric, legacy, padded, active/completed, and cross-branch identities fail closed without duplicate normalization logic.
3. Preserve the CLI-canonical doctor transaction and all six review remediations: no-clobber install, board-export preflight, parent-aware dotted IDs, complete reference scans, Windows-safe paths, and human-readable blocked repair.
4. Integrate server and Web recovery into current content-store reload, latest-request-wins data loading, route/history/error behavior, and shared modal focus lifecycle; keep MCP as an adapter.
5. Add deterministic merge-era regressions for large/legacy ambiguity, config/root service refresh, stale duplicate-plan loads, task-route coexistence, destructive focus transitions, and best-effort 390px layout.
6. Run focused and full tests, TypeScript, Biome, build, compiled CLI smokes, and Browser QA only after permission; update task evidence and freeze for independent review without push or merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merge takeover context (2026-07-10)

Integrated main 2b6b2adb by a normal merge while preserving main task identity, active-branch freshness, config-root lifecycle, SPA route history, and ownerDocument modal focus containment. Duplicate recovery composes with those surfaces through one precision-safe identity implementation, one existing ContentStore refresh, and the CLI-canonical doctor preview, fingerprint, and apply contract.

Scope stops at human-first recovery. Issue #711 remains related and open for any separate collision-prevention policy.

Validation is clean: focused merged matrix 192 passed with 962 assertions; full suite 1627 passed with 2 intentional interactive skips and 6569 assertions; TypeScript, Biome, build, and diff-check passed. Compiled CLI doctor preview, confirmed repair, and verification passed. Chrome QA passed at 1920px and best-effort 390px: deterministic TASK-2 and TASK-3 preview, ambiguous reference review, focus trap and restoration, no viewport overflow after sidebar collapse, zero console warnings or errors, successful repair refresh, and post-repair doctor verification.

The local merge commit remains intentionally unpushed pending independent code, specification, and UX review. PR relationship wording must remain neutral and must not close #711.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented human-first duplicate task ID diagnosis and deterministic repair across CLI, core, MCP, server, TUI, and Web. The flow fails closed on ambiguity, preserves manual reference review, handles precision-safe numeric, dotted, padded, legacy, active/completed, lifecycle, stale-plan, and no-clobber cases, and keeps issue #711 as related follow-up scope. Verified by 1627 passing tests, TypeScript, Biome, build, compiled CLI smoke, and desktop/390px Chrome repair QA with no console errors.
<!-- SECTION:FINAL_SUMMARY:END -->
