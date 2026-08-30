---
id: BACK-658
title: Resolve dependency targets in completed and archived tasks
status: Done
assignee:
  - '@Fable'
created_date: '2026-08-30 15:23'
updated_date: '2026-08-30 15:43'
labels:
  - cli
  - mcp
  - web
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/942'
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
validateDependencies (src/utils/task-builders.ts:52-84) builds its known-ID set from working-copy tasks plus drafts only, so a dependency on a task that lives in backlog/completed/ or archive is refused at write time — even though Done is the normal end state of a predecessor. Combined with the replace-only semantics of --depends-on, a task whose dependency completed can no longer have its dependency list edited at all (GitHub issue #942). Fix: dependency validation resolves targets across working-copy tasks, drafts, completed, and archived records via the shared identity rules; readiness/graph semantics for such targets stay as already defined.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A dependency on a task in completed/ or archive is accepted at create and edit time on CLI, MCP, and web
- [x] #2 Editing the dependency list of a task whose predecessors are Done works
- [x] #3 Unknown IDs are still rejected; ambiguous identities still fail closed
- [x] #4 Tests cover completed, archived, draft, unknown, and ambiguous targets
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Widen the known-ID corpus in validateDependencies (src/utils/task-builders.ts) to include filesystem.listCompletedTasks() and filesystem.listArchivedTasks() alongside working-copy tasks and drafts; identity matching stays taskIdsEqual/canonicalTaskId.
2. Keep the core.loadTaskById working-copy ambiguity check as-is: its index already covers completed tasks, and archived-only IDs resolve to null there exactly like drafts (the call exists only to catch multi-file ID claims). Update the comments.
3. Tests in src/test/dependency.test.ts: completed target accepted at create and edit, archived target accepted, draft target still accepted, unknown ID still rejected, duplicate identity across stores fails closed; bare task/draft numeric ambiguity covered by existing cli-custom-prefix test stays green.
4. No readiness/graph changes; keep the change composable with BACK-656 (future self/cycle checks in the same function).
5. Verify: bunx tsc --noEmit, bun run check ., bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Widened the validateDependencies corpus with listCompletedTasks/listArchivedTasks; loadTaskById ambiguity check unchanged (its index already covers completed; archived resolve null like drafts). Tests added in src/test/dependency.test.ts for completed/archived/draft/unknown/duplicate-identity targets; bare task+draft numeric ambiguity test stays green. Notable: the ID allocator reuses an archived task's ID when it was the highest, so a dependency on such an archived task correctly fails closed as ambiguous once the ID is reissued.

Verification: bunx tsc --noEmit clean, bun run check . clean, full bun run test green (2579 tests, 0 fail) after bun i refreshed a stale worktree node_modules (neo-neo-bblessed 1.0.9 -> 1.0.10, known cross-worktree issue). Added a CLI end-to-end test for the completed-predecessor scenario on top of the core-level coverage; MCP and web funnel through the same createTaskFromInput/updateTaskFromInput paths.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Widened the validateDependencies known-ID corpus (src/utils/task-builders.ts) to span working-copy tasks, drafts, completed, and archived records under the existing taskIdsEqual/canonicalTaskId identity rules, so a Done or archived predecessor is a valid dependency target at create and edit time on CLI, MCP, and web. Validation only: readiness/graph semantics untouched, unknown IDs still rejected, ambiguous identities still fail closed (bare task/draft numerics and duplicate identities across stores). Verified with new tests in src/test/dependency.test.ts and src/test/cli-dependency.test.ts covering completed, archived, draft, unknown, and ambiguous targets, plus tsc, biome, and the full bun test suite.
<!-- SECTION:FINAL_SUMMARY:END -->
