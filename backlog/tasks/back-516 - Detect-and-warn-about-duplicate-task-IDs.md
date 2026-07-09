---
id: BACK-516
title: Detect and warn about duplicate task IDs
status: In Progress
assignee:
  - '@codex-duplicate'
created_date: '2026-05-03 20:54'
updated_date: '2026-07-09 22:44'
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
1. Trace task loading, exact lookup, mutation, CLI rendering, server endpoints, and duplicate warning paths; record shared invariants and reusable operations.
2. Introduce one shared collision model using canonical numeric IDs and explicit task file paths, covering active and completed tasks while excluding intentional archived-only reuse.
3. Make ID-based reads and mutations reject ambiguous matches and make list/search/board surface collision diagnostics.
4. Add a CLI-canonical doctor command that diagnoses collisions, previews deterministic renames and reference-review findings, and applies only after explicit confirmation or a safe noninteractive flag.
5. Reuse the same core preview/apply operations from the desktop Web UI, replacing agent-oriented copied instructions with a human recovery flow.
6. Add focused tests across utility/core/CLI/server/Web boundaries, then run typecheck, Biome, build, targeted tests, and the full suite.
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
<!-- SECTION:NOTES:END -->
