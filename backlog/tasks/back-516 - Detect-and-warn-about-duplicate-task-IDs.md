---
id: BACK-516
title: Detect and warn about duplicate task IDs
status: In Progress
assignee:
  - '@codex-duplicate'
created_date: '2026-05-03 20:54'
updated_date: '2026-07-09 23:22'
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
  - src/test/duplicate-detection.test.ts
  - src/test/duplicate-task-repair.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/server-duplicate-repair.test.ts
  - src/test/unified-view-loading.test.ts
  - src/test/web-duplicate-id-repair.test.tsx
  - src/ui/unified-view.ts
  - src/utils/duplicate-detection.ts
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
Duplicate task IDs can arise after merges or from equivalent numeric spellings such as TASK-1 and TASK-01. Current behavior can silently collapse tasks, and the recovery flow assumes an AI agent.

Implement a human-first, CLI-canonical diagnosis and repair workflow. The CLI must detect collisions anywhere a view could collapse them, fail closed for ambiguous ID-based operations, preview deterministic file-level repairs, and safely apply an explicitly confirmed repair. The desktop browser must expose the same shared capability. MCP remains an adapter rather than the product-defining workflow. Archived IDs remain intentionally reusable.
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
- [x] #6 Desktop Web uses shared diagnosis and repair semantics and no longer offers AI-agent copy/prompt instructions; mobile UX is out of scope.
- [x] #7 Shared core behavior is covered at utility/core/CLI/server/Web boundaries for 3-way duplicates, active+completed, TASK-1 vs TASK-01, ambiguity, atomic failure, prompt removal, successful repair, and verification.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace destination rename with one atomic no-replace install primitive and add a deterministic late-destination regression that proves rollback preserves external content.
2. Run the shared duplicate preflight before board export loads or writes any collapsed task view, with a CLI regression for untouched output.
3. Preserve dotted duplicate identity with validated parent-aware allocation; block malformed or mismatched subtask groups.
4. Make reference scanning return explicit completeness state, block repair on glob/read failures, and propagate human-readable incomplete copy through CLI and Web.
5. Add shared Modal focus containment/restoration and destructive-flow stage focus, Escape, close, and keyboard regressions.
6. Normalize platform-sensitive assertions and run the focused Windows-relevant tests locally where possible.
7. Rerun focused boundary tests, full suite, typecheck, Biome, build, compiled CLI/doctor/board smokes, and desktop Browser keyboard/console QA before updating the task and PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
L2 implementation reopened after release-candidate audit found silent CLI data loss, unsafe/incomplete collision semantics, and an agent-only repair UX. Work is isolated on tasks/back-516-human-duplicate-recovery. Mobile browser behavior is explicitly out of scope.

L2 context brief (2026-07-10)

Analogous files reviewed:
- src/utils/task-path.ts and src/test/task-path.test.ts: numeric-equivalent lookup, zero-padding semantics, and current first-match risk.
- src/file-system/operations.ts and src/core/backlog.ts: active/completed directory boundaries, create lock, ID allocation, local-vs-branch loading, mutation entry points, and existing rollback conventions.
- src/core/content-store.ts and src/core/search-service.ts: Map/index collapse points that require pre-render diagnostics.
- src/core/task-loader.ts and branch loader tests: branch identity is path/ref-qualified; cross-branch repair must remain diagnostic-only.
- src/core/prefix-migration.ts and milestone rename code: closest rename analog; migration is not sufficiently atomic, while milestone rename demonstrates rollback expectations.
- src/cli.ts cleanup/list/search/board handlers and help-schema tests: root-command registration, preview/confirm patterns, plain-output conventions, and noninteractive validation.
- src/server/index.ts plus server cleanup/search tests: GET preview + POST execute route pattern and 4xx error mapping.
- src/web/components/CleanupModal.tsx, Modal.tsx, DuplicateIdWarning.tsx, App.tsx, and Web JSDOM tests: compact launcher + explicit confirmation modal and component-test conventions.
- src/mcp/tools/tasks/handlers.ts: MCP warning is currently agent-prompt-specific and must become a CLI adapter message.

Patterns and reusable operations:
- Use taskIdsEqual-compatible canonical numeric identity so TASK-1 and TASK-01 collide.
- Scan raw active and completed files before any Map-backed view; exclude archive because archived IDs are intentionally reusable.
- Reuse Core.generateNextId and Core.withCreateLock so repair follows configured prefix/padding and the same allocation serialization as create/promote/demote.
- Preserve raw task content by patching only the top-level frontmatter id line and filename; do not parse/serialize the whole task.
- Express repair as one shared serializable preview with exact project-relative paths, deterministic keep/rename choices, a fingerprint, and reference-review lines. CLI, server, Web, and MCP consume that contract.
- Apply via staged files plus rollback, after revalidation under the create lock; never update ambiguous references automatically.

Risks and decisions:
- Same logical task versions across branches are normal; only path-distinct branch collisions may be reported, and they are never repaired from another branch.
- Active tasks win the keep-original choice over completed tasks; remaining paths sort lexically for deterministic repair.
- Any changed source, occupied destination, filename/frontmatter mismatch, or stale preview aborts before commit and requires a fresh preview.
- Plain list/search and TUI/board retain readable output but emit a shared high-visibility diagnostic and nonzero integrity status where applicable. ID-based reads/mutations throw an actionable ambiguity error with exact paths.
- Mobile browser behavior is intentionally out of scope.

Naming evidence:
- duplicate-task-repair.ts follows core/prefix-migration.ts and core/reorder.ts for cross-filesystem domain operations.
- AmbiguousTaskIdError follows CreateLockError and BacklogToolError error families.
- DuplicateIdRepairModal.tsx follows CleanupModal.tsx; DuplicateIdWarning remains the compact launcher.
- backlog doctor is a new public term mandated by the accepted issue direction; no existing command analog exists.

Implementation complete (2026-07-10)

Delivered:
- Shared canonical collision semantics cover active and completed tasks, numeric zero-padding equivalence, deterministic ID allocation, exact paths, reference-review findings, and intentional archive reuse.
- ID-based reads and mutations now fail closed on ambiguity across CLI, core, server, and MCP adapter surfaces.
- backlog doctor provides preview by default, interactive confirmation for --fix, safe explicit --fix --yes automation, atomic staged repair with rollback, and diagnostic-only cross-branch findings.
- Desktop Web now uses the same preview/fingerprint/apply flow with a compact warning, exact rename paths, references, blocked reasons, and a second explicit confirmation. Agent copy/prompt language was removed; mobile remains out of scope.

Validation evidence:
- Focused boundary matrix: 68 passed, 0 failed across utility, core, atomic creation, CLI, MCP, server, TUI, and Web tests.
- Full suite: 1512 passed, 2 intentionally skipped, 0 failed across 1514 tests; 5191 assertions.
- bunx tsc --noEmit, bun run check ., and bun run build pass.
- Desktop browser QA used a disposable 3-file TASK-1/TASK-01/TASK-001 fixture spanning active and completed tasks. Verified compact warning, canonical TASK-1 keeper, exact source/destination paths, two ambiguous reference lines, second confirmation, successful repair, immediate board refresh, warning removal, and zero console warnings/errors.
- Post-repair CLI verification reported no duplicate active/completed IDs and showed TASK-1, TASK-2, TASK-3, plus completed TASK-4 with task bodies preserved.

CHANGES_REQUESTED remediation context brief (2026-07-10)

Complexity: L2. Six independently reproduced findings cross filesystem transaction semantics, CLI export integrity, task hierarchy, reference completeness, Windows portability, and Web accessibility.

Analogous files and patterns reviewed:
- src/core/duplicate-task-repair.ts and its rollback tests: one staged transaction already owns source backups and cleanup; add one no-replace install primitive rather than another transaction layer.
- src/utils/prefix-config.ts and Core.generateNextId: existing generateNextSubtaskId and parent-aware allocation preserve dotted namespaces and configured padding.
- src/cli.ts task list/search duplicate preflight and board export: printDuplicateIntegrityWarning is the shared path-qualified guard and must run before core.loadTasks collapses IDs.
- src/web/components/Modal.tsx, CleanupModal.tsx, and DuplicateIdRepairModal.tsx: Modal already owns Escape/backdrop/body-lock behavior, so focus containment/restoration belongs there; destructive stage focus remains local to DuplicateIdRepairModal.
- src/test/web-duplicate-id-repair.test.tsx and JSDOM modal tests: interaction-level focus assertions fit the existing Web boundary suite.
- Existing Windows-safe test patterns use platform-neutral normalization or skip only filesystem-permission probes that cannot be expressed portably.

Risks and decisions:
- Atomic install must never replace a path created after preview; external content wins and the entire repair rolls back.
- Dotted IDs are repaired only when every duplicate has a canonical parent matching the ID namespace; otherwise the preview is explicitly blocked.
- Reference scan completeness is a first-class plan field and part of the fingerprint so a failed or changed scan requires a fresh preview.
- Board export aborts before loading the collapsible view or touching the target file.
- Modal listeners use stable callback refs; initial focus chooses the safe Cancel action, confirmation focuses the final Repair action, Tab is trapped, and close restores the trigger.
- Mobile remains out of scope.

CHANGES_REQUESTED remediation complete (2026-07-10)

Delivered:
- Destination installation now uses one atomic no-replace hard-link claim; EEXIST preserves the external file and enters the existing full rollback path.
- Board export runs the shared duplicate preflight before loading or writing a collapsed view.
- Dotted duplicates retain their parent namespace through parent-aware allocation; missing or mismatched parents block the full group.
- Reference scan completeness and failures are explicit, fingerprinted, human-readable, and repair-blocking across CLI and Web.
- The shared desktop Modal now owns safe initial focus, two-way Tab containment, Escape handling, close restoration, and disabled close state; the destructive confirmation stage focuses its Repair action.
- Platform-sensitive path assertions are normalized; permission-only probes are skipped on Windows.

Objective validation:
- Focused eight-boundary matrix: 76 passed, 0 failed, 362 assertions.
- Full suite: 1540 passed, 2 intentional skips, 0 failed across 1542 tests and 182 files; 5363 assertions.
- bunx tsc --noEmit, bun run check ., bun run build, and git diff --check pass.
- Compiled CLI board-export smoke exited nonzero and preserved sentinel output; doctor preview/fix/verify exited 1/0/0; compiled dotted-subtask smoke preserved TASK-1 parent identity and allocated TASK-1.2.
- Desktop Chrome keyboard QA verified Cancel initial focus, forward/backward Tab wrapping, Repair stage focus, Escape and header-close restoration to Review repair, visible focus treatment, and zero console warnings/errors. Evidence: /tmp/backlog-back-516-focus-qa/initial-cancel-focus.png, confirmation-repair-focus.png, restored-review-focus.png.
- Rebased on required main 7a9497698e1a3183b6459715d4675ed9f7ef45e5; task intentionally remains In Progress pending fresh exact-head review and CI.

Final exact-base validation (2026-07-10)

The branch was rebased again after main advanced. This supersedes the earlier base reference: exact origin/main is f48225bd01247e78409abd3965ccc443e0793648. After that rebase, the focused matrix remained 76 passed / 0 failed / 362 assertions; the full suite is 1544 passed / 2 intentional skips / 0 failed across 1546 tests and 183 files with 5377 assertions. TypeScript, Biome (319 files), build, and diff-check all pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the human-first, CLI-canonical duplicate-ID diagnosis and recovery flow across CLI, core, server, MCP adapter, TUI, and desktop Web. Review remediation makes destination install no-clobber, blocks board export before collapse, preserves subtask identity, fails closed on incomplete reference scans, and completes keyboard focus containment/restoration. On exact main f48225bd, verification passes with 76 focused tests, the 1544-pass full suite, typecheck, Biome, build, compiled CLI smokes, and desktop Chrome keyboard/console QA.
<!-- SECTION:FINAL_SUMMARY:END -->
