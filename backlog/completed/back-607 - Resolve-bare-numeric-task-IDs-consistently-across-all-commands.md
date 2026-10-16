---
id: BACK-607
title: Resolve bare numeric task IDs consistently across all commands
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 19:55'
labels: []
dependencies: []
ordinal: 246000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With a non-default ID prefix configured, backlog task 597 resolves the task but backlog task edit 597 fails, because ID resolution is duplicated across command paths instead of shared. Approved direction from Alex (2026-08-08): route every command that accepts a task ID through the same resolution path so bare numeric IDs behave identically everywhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task edit accepts bare numeric IDs wherever task view does, including with a custom ID prefix
- [x] #2 All ID-accepting commands share a single resolution path
- [x] #3 Tests with a custom prefix cover view, edit, and the other ID-accepting commands
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce with a BACK-prefixed project: 'backlog task 1' resolves, 'backlog task edit 1' prints 'Task 1 not found.'. Root cause: CLI pre-normalizes user input with normalizeTaskId(), which stamps the DEFAULT 'task' prefix onto bare numeric IDs before the shared resolver ever sees them, so 'task-1' never matches 'BACK-1'.
2. Map every ID-accepting surface and record which ones pre-normalize: task view / task <id> / task archive / task complete / task demote / MCP already pass raw input into Core (shared resolver); task edit (+ its wizard), task list --parent, and --depends-on/--dep pre-normalize and break.
3. Fix by deleting the premature normalization so all commands hand the raw argument to the one shared resolver (Core.getTask -> ContentStore.resolveTaskForRead / loadLocalTaskForMutation -> TaskIdentityIndex, which already fails closed with AmbiguousTaskIdError):
   - task edit: drop canonicalId, resolve raw via core.loadTaskById, then use the resolved task.id for editTask and error formatting (also un-masks ambiguity, which currently degrades to 'not found').
   - task edit wizard: drop normalizeTaskId on the taskId argument.
   - task list --parent: match on the raw value via taskIdsEqual; use canonicalTaskId(input, configured task prefix) for display only so 'not found' text stays correct under any prefix.
   - dependencies: delete normalizeDependencies (it applied the default prefix) in favour of the existing parseDelimitedStringList; validateDependencies already canonicalizes to real IDs via taskIdsEqual. Make removeDependencies compare with taskIdsEqual instead of exact strings.
   - task demote: resolve first like archive/complete, echo the resolved ID, and exit 1 when unresolved.
   - Use resolved IDs (not re-normalized raw input) in complete/demote commit messages and in the create --parent not-found message.
4. Delete the now-unused normalizeTaskId import from cli.ts; no new resolver and no new flags.
5. Prove it with a table-driven test over every ID-accepting command in a BACK-prefixed project, each run twice (bare numeric + prefixed), plus draft commands, plus a duplicate-ID case asserting task edit now reports the fail-closed ambiguity error.
6. Verify: bunx tsc --noEmit, bun run check ., full bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: nothing was wrong with the resolver. The CLI pre-normalized user input with normalizeTaskId(), which stamps the DEFAULT 'task' prefix onto a bare numeric ID, so 'backlog task edit 597' asked the shared resolver for TASK-597 in a project whose tasks are BACK-597. Commands that passed the raw argument through to Core (task view, task <id>, task archive, task complete, and every MCP tool) already worked, which is why the two surfaces disagreed.

Command map (custom prefix BACK, bare numeric '1'):
- Already correct, raw input into Core's resolver: task <id>, task view, task archive, task complete, task demote (resolution only), task create --parent, draft <id>, draft view, draft archive/promote (resolution only).
- Broken: task edit ('Task 1 not found.'), task edit wizard, task list --parent ('Parent task TASK-1 not found.'), task create --dep / task edit --dep ('dependencies do not exist: TASK-1').
- Misreported the target even when resolution worked: task demote and draft archive/promote echoed the raw argument ('Demoted task 1'), and complete/demote commit messages used normalizeTaskId(raw input), writing 'TASK-1' into history for a BACK project.

Fix: removed the premature normalization instead of adding a resolver. Every ID-accepting command now hands the raw argument to the one shared path (Core.getTask -> ContentStore.resolveTaskForRead / loadLocalTaskForMutation -> TaskIdentityIndex) and uses the resolved task.id for output, commit messages, and follow-up mutations. Deleted normalizeDependencies() (32 lines, whose entire job was the buggy default-prefix stamping) in favour of the existing parseDelimitedStringList; validateDependencies already canonicalizes to real IDs via taskIdsEqual, so stored dependencies stay canonical. removeDependencies now compares with taskIdsEqual rather than exact strings. --parent keeps a display-only canonicalTaskId(input, configured prefix) so 'not found' text names BACK-999, not TASK-999.

Side effect worth noting: 'task edit <ambiguous id>' used to report 'Task 1 not found.' because the mangled ID matched nothing, masking a duplicate-ID collision. It now surfaces the same fail-closed AmbiguousTaskIdError as every other command. task demote and draft archive/promote also now exit 1 when the ID does not resolve; previously they printed an error and exited 0.

Fail-closed behavior is unchanged: no new resolver, no new ID forms, no change to ID generation, and the AmbiguousIdError shape is untouched.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bare numeric task IDs now resolve identically on every ID-accepting command under any configured ID prefix. The bug was premature normalization, not resolution: the CLI rewrote user input with the default 'task' prefix before the shared resolver saw it, so 'task edit 597' looked for TASK-597 in a BACK project. Removed that normalization from task edit (and its wizard), task list --parent, and the dependency flags; deleted normalizeDependencies() in favour of the existing parseDelimitedStringList; and made task demote plus draft archive/promote resolve first so their output, commit messages, and exit codes name the real task. No new resolver, no new ID forms, no change to ID generation, and AmbiguousTaskIdError is untouched.

Verified with src/test/cli-custom-prefix-id-resolution.test.ts: a table over 14 ID-accepting commands run with both a bare numeric and a prefixed ID in a BACK-prefixed project (31 tests), plus a duplicate-ID case asserting all six task commands still fail closed with 'is ambiguous' and leave both files in place. Confirmed the table fails 10 tests against the pre-fix code via git stash. Also checked by hand that every ID form that resolved before (task-1, TASK-1, Task-1, 1, 001, task-001) still resolves on the default prefix. bunx tsc --noEmit and bun run check . clean; full bun run test green at 2113 pass / 0 fail (two earlier runs each hit a different watcher/timing test under concurrent load, both green in isolation).
<!-- SECTION:FINAL_SUMMARY:END -->
