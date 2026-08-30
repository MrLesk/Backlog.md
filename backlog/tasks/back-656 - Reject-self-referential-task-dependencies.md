---
id: BACK-656
title: Reject self-referential and cyclic task dependencies
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-30 12:30'
updated_date: '2026-08-30 23:11'
labels:
  - cli
  - mcp
  - web
  - bug
dependencies: []
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task can currently depend on itself: `backlog task edit TASK-1 --dep TASK-1` succeeds and stores the dependency (verified), after which readiness treats the task as permanently blocked by itself. Cycles are equally storable via two edits (A depends on B, then B depends on A); BACK-548 renders them honestly but nothing prevents creating them. Dependency validation must reject a dependency that resolves to the task being edited or created AND any dependency that would close a cycle through the existing graph, in the single shared validation owner so CLI, MCP, and web all inherit it, including alias forms of the same identity (task-1, TASK-001). Reuse the BACK-548 graph model for cycle detection rather than writing a second traversal. backlog doctor reports existing self-dependencies and cycles in projects that already have them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creating or editing a task with itself as a dependency fails with a clear error on CLI, MCP, and web
- [x] #2 Alias forms of the same identity (case, zero-padding) are rejected the same way
- [x] #3 backlog doctor reports an existing self-dependency
- [x] #4 Tests cover direct and alias-form self-dependencies across the shared validation path
- [x] #5 Adding a dependency that would close a cycle through the existing graph is rejected with an error naming the cycle path
- [x] #6 Cycle detection reuses the shared dependency-graph model; no second traversal is introduced
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend validateDependencies (src/utils/task-builders.ts) with an optional target task: reject any dependency whose resolved identity equals the target (taskIdsEqual catches case/zero-padding aliases) with a clear self-dependency error.
2. Cycle detection reuses BACK-548 graph model: build buildDependencyGraph({...target, dependencies: valid}) over the same corpus validation already loads (tasks+drafts+archived as tasks, completed as completedTasks); add findCycleThroughRoot(graph) in src/utils/dependency-graph.ts that walks the already-built graph edges (BFS, resolved nodes only) and returns the shortest cycle path through the root. No second corpus traversal.
3. Pass the task under edit from applyTaskUpdateInput's two validateDependencies calls (covers CLI, MCP, web, and draft edits via the shared core owner). Create passes no target: the new ID is unallocated so a self/cyclic dep cannot resolve there.
4. backlog doctor: load the same corpus via a shared helper, report existing self-dependencies and cycles (deduped by rotation) in doctor's existing report style, report-only, exit 1; update the doctor help schema text.
5. Tests: direct + alias-form self-deps at the shared validation path, two-node and multi-hop cycle rejection asserting the named path, doctor report coverage, and a surface check that the error copy reaches server/CLI. Run tsc, biome, bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation owner: validateDependencies (src/utils/task-builders.ts) now takes the task being edited as an optional target. Each resolved dependency is compared with taskIdsEqual, so task-1/TASK-001/case aliases of the target are rejected as self-dependencies. Cycle detection reuses the BACK-548 graph model: the validated dependencies become the target's edges in one buildDependencyGraph call over the same corpus validation already loads (tasks+drafts+archived, completed), and the new findCycleThroughRoot (src/utils/dependency-graph.ts) walks only the already-built graph edges (BFS, resolved nodes only) to return the shortest cycle path - no second corpus traversal. Every new cycle must run through the edited task because all added edges leave it, so per-edit checking is complete; pre-existing cycles elsewhere never block unrelated edits, and a stored legacy self-dependency is ignored by the cycle finder (tested) and left to doctor. Create passes no target: the new ID is unallocated, so no input can resolve to it and nothing depends on it. CLI, MCP, and web all inherit through createTaskFromInput/updateTaskFromInput/applyTaskUpdateInput (draft edits included). backlog doctor gains findDependencyDefects: report-only findings for stored self-dependencies (with recorded spelling) and cycles (deduped by membership, one line per cycle), doctor exit 1, --fix refuses them as not automatically repairable; all-clear copy extended. Verified: bunx tsc --noEmit clean, bun run check . clean, full bun test 2736 pass with only the 3 pre-existing tui-emoji-width failures that also fail on a clean origin/main tree; live CLI check confirmed exit 1, error copy, and no file written for both defects, and doctor reporting a hand-written legacy self-dep.

Review adjudication (Codex threads on PR #978), fixes: ACCEPTED+FIXED dkhpF - create could materialize a cycle when a stored dangling reference named the next allocated ID; dependency validation now runs inside the create lock with the allocated identity as target (regression test: dangling forward ref + create --dep rejected, nothing written). ACCEPTED+FIXED dkhpI - doctor --fix --yes now keeps exit 1 and prints a line when dependency findings remain after repairing duplicates (test added). ACCEPTED+FIXED dkhpQ - cycle dedupe now keys on the rotation starting at the smallest canonical member instead of suppressing later cycles sharing a vertex, so distinct cycles through one task are all reported (tested); full elementary-cycle enumeration stays out of scope, doctor is iterative. PARTIAL dkkP8 - verified live that task edit cannot target completed records and that --remove-dep does not exist; doctor guidance now names the real flags (--dep / --clear-deps) and directs completed-record fixes to the file, consistent with doctor's other hand-repair copy; a CLI mutation path for completed records is deferred as scope growth.

Review adjudication, refutes/defers: REFUTED dkhpB - validation already runs inside the edited task's own lock; per-task locks deliberately do not serialize edits of different tasks, and no process lock can stop the same cycle arriving when two branches each add one edge and are merged, which is exactly why doctor reports stored cycles as the designed backstop; a global graph lock is disproportionate for a local-first tool. REFUTED dkhpT - the implementer is Claude and the record is assigned @Claude per CLAUDE.md; the commit is authored under Alex's own identity, not Codex. REFUTED dkkP6 - archived records sit outside every read corpus and readiness with no supported mutation path; cycles that touch the working corpus through an archived task ARE reported since archived stays in the resolution corpus; archive-internal defects are inert. DEFERRED dkhpN - doctor is an explicit diagnostic; dependency-free roots are skipped and per-root graph builds are acceptable at real project sizes; revisit on observed latency. DEFERRED dkkP_ - supported flows never store bare numeric refs (validation persists resolved full IDs); canonicalizing stored bare refs under the default prefix is pre-existing shared BACK-548 model behavior that readiness and rendering share, so changing it here would fork the model this task mandates reusing; a model-level fix would be its own task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dependency validation (validateDependencies, the single shared owner) now rejects a dependency resolving to the task being edited itself - alias spellings included - and any dependency that would close a cycle, with an error naming the full cycle path (e.g. TASK-1 -> TASK-3 -> TASK-2 -> TASK-1). Cycle detection reuses the BACK-548 dependency-graph model via one buildDependencyGraph call plus a new findCycleThroughRoot walk over the built graph; no second traversal. CLI, MCP, and web inherit through the shared core edit path. backlog doctor reports existing self-dependencies and cycles report-only in its established style. Verified with core, MCP, server, and doctor tests (full suite green apart from 3 pre-existing environment-only failures), tsc, biome, and a live CLI walkthrough.
<!-- SECTION:FINAL_SUMMARY:END -->
