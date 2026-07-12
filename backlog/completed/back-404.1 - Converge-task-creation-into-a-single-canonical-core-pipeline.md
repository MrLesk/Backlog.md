---
id: BACK-404.1
title: Converge task creation into a single canonical core pipeline
status: Done
assignee:
  - '@MrLesk'
created_date: '2026-03-19 23:46'
updated_date: '2026-03-20 20:02'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/565'
parent_task_id: BACK-404
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-404 / PR #565 fixed concurrent ID allocation for create-like operations, but it also made an older architectural problem more visible: Backlog.md still has overlapping task-creation orchestration paths that duplicate semantics and make future behavior changes expensive to maintain. In particular, src/core/backlog.ts currently has multiple create entry points with shared responsibilities (for example createTaskFromData and createTaskFromInput), and the create path still has leftover helper logic outside the canonical core flow.

This follow-up should be a single focused refactor PR whose goal is architectural simplification, not new user-facing behavior. The outcome should be one canonical core task-creation pipeline that owns normalization, validation, default resolution, ID allocation, persistence, and post-write finalization for both regular tasks and drafts.

Required architectural direction:
- Treat Draft as a reserved task status in domain logic, not as a separate domain kind or flag.
- Keep the choice of storing a record under tasks vs drafts as a persistence concern derived from the resolved status, not something callers need to model.
- Prefer deleting or collapsing duplicate orchestration over adding more wrappers or defensive branches.
- Keep filesystem helpers low-level and persistence-oriented; avoid spreading task-creation business logic across CLI, core, and filesystem layers.

Minimum local context for the implementer:
- Review the merged locking work in PR #565 and the related task BACK-404 before planning changes.
- Inspect src/core/backlog.ts, src/cli.ts, src/utils/task-builders.ts, src/file-system/operations.ts, src/mcp/tools/tasks/handlers.ts, and src/server/index.ts to identify which create entry points are still carrying overlapping logic.
- Preserve all currently supported create semantics unless an explicit follow-up task is approved for behavior changes.

Non-goals:
- No intended user-facing behavior change.
- Do not expand this into a broader task lifecycle rewrite; focus on converging the create path only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Core task creation has one canonical orchestration path that owns normalization, validation, default/status resolution, ID allocation, persistence, and post-write finalization for both regular tasks and drafts; any remaining wrappers are thin adapters with no duplicated business logic.
- [x] #2 The domain create flow models Draft as a reserved status, not as a separate kind/property; persistence decides whether the record is stored under drafts or tasks based on the resolved status.
- [x] #3 CLI, MCP, and server/web task-creation entry points continue to use the canonical create path and preserve the current behavior shipped after BACK-404, including repo autoCommit handling, cross-branch dependency validation, comma-delimited --ref/--doc parsing, and support for existing create inputs such as description, acceptance criteria, Definition of Done defaults/additions, priority, milestone, ordinal, references, and documentation.
- [x] #4 The refactor removes or collapses stale/duplicate create-path helpers so the create architecture is materially simpler to maintain than before this task.
- [x] #5 Automated regression coverage is updated or added for both task and draft creation through the canonical path, and the implementer runs the relevant touched test suites and records the commands/results in the task final summary.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Collapse the overlapping create orchestration in src/core/backlog.ts so one canonical internal create path owns normalization, validation, default/status resolution, ID allocation, persistence, and post-write finalization for both tasks and drafts.
2. Treat Draft as a reserved status in that shared path, with persistence deciding whether the record is written to tasks or drafts; remove internal duplicate create helpers such as createTaskFromData or createDraft entirely if all in-repo callers can be updated safely.
3. Remove stale create-path duplication in src/cli.ts and src/utils/task-builders.ts by keeping CLI/MCP/server entry points on core.createTaskFromInput, centralizing list parsing, and deleting dead local helpers such as buildTaskFromOptions and the CLI-local dependency validator.
4. Add or update focused regressions for task creation and draft creation through the canonical path, plus the existing auto-commit, cross-branch dependency, and refs/docs CLI coverage that protects preserved behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed duplicate internal create entry points (`createTaskFromData` and `createDraft`) and migrated in-repo draft callers to `createTaskFromInput` so the canonical path owns draft and task creation.

Verification completed on the clone: targeted create/draft/CLI suites passed (`src/test/core.test.ts`, `src/test/cli.test.ts`, `src/test/cli-plain-output.test.ts`, `src/test/cli-refs-docs.test.ts`, `src/test/auto-commit.test.ts`, `src/test/dependency.test.ts`, `src/test/draft-create-consistency.test.ts`), then broader create-adjacent suites passed (`src/test/acceptance-criteria.test.ts`, `src/test/definition-of-done-cli.test.ts`, `src/test/implementation-plan.test.ts`, `src/test/implementation-notes.test.ts`). `bunx tsc --noEmit` and `bun run check .` both passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Collapsed duplicate create helpers and routed draft creation through the canonical task create pipeline. Removed `createTaskFromData` and `createDraft` from core, updated in-repo draft callers to use `createTaskFromInput({ status: "Draft" })`, and simplified the CLI to share the common dependency/list parsing helpers. Verified with focused create, draft, CLI refs/docs, auto-commit, dependency, acceptance criteria, DoD, implementation plan, and implementation notes suites, plus `bunx tsc --noEmit` and `bun run check .`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
