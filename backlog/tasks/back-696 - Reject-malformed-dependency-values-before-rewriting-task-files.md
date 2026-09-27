---
id: BACK-696
title: Reject malformed dependency values before rewriting task files
status: Done
assignee:
  - '@codex-dependency-validation'
created_date: '2026-09-27 22:22'
updated_date: '2026-09-27 22:51'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1031'
modified_files:
  - src/markdown/parser.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/test/malformed-task-dependencies.test.ts
priority: high
type: bug
ordinal: 326000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An unrelated task edit currently converts a structured dependency entry into [object Object] and reports success. Refuse the malformed task input with a useful diagnostic before any write. Keep dependencies as existing task ID values; do not add dependency metadata or fragments.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An unrelated edit of a task containing a mapping or nested list in dependencies fails without changing the task file.
- [x] #2 The error identifies the dependencies field and offending task or file so a human can repair the Markdown.
- [x] #3 Valid dependency lists continue to load and support normal task edits through the shared task mutation path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the destructive CLI rewrite for mapping entries, nested arrays, and a mapping used as the dependencies field.
2. Reject those structures in the shared task parser before scalar coercion, with dependency field, task ID, and entry context. Preserve scalar, numeric, null, and boolean behavior.
3. Propagate the parser error through targeted filesystem reads and stale-task saves. Keep healthy task listing behavior and the identity index authoritative. Retry diagnostic reads when the selected project changes.
4. Verify exact-byte preservation and useful CLI failure output, warmed Core mutations, stale saves, healthy tasks, valid dependency edits, and in-flight project switches. Run relevant regressions, TypeScript, Biome, and diff checks.
5. Apply review corrections, complete the subtraction review, finalize the task record, and publish only the scoped fix and task record to main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Planning evidence: reviewed GitHub #1031 with gh. parseTask currently uses dependencies.map(String), unchanged since the original parser commit 5d3dc1b3; mappings become [object Object] and nested lists become comma-joined strings.

FileSystem.readTaskFiles intentionally skips malformed files; filesystem-task-cache.test.ts requires malformed files not to serve stale cached tasks. FileSystem.loadTask catches parse errors as null. Core local reads/mutations build a working-copy identity index from listTasks, so parser-only validation would hide the target. A warmed ContentStore can retain old tasks on refresh failures, and saveTask currently catches errors while re-reading existing source.

Numeric ID shorthand is a deliberate public CLI behavior: cli-custom-prefix-id-resolution.test.ts proves --dep 1 stores BACK-1. Existing raw YAML numeric-list values are coerced to strings, but no explicit raw numeric-YAML test or documentation was found. Preserve that existing convention. Rejection of null/boolean entries and non-list scalar containers is outside the mapping/nested-list proof pending coordinator scope confirmation.

Coordinator scope decision: reject mapping or nested-array dependency entries, and structured non-list dependencies values that would otherwise be discarded. Preserve current primitive scalar coercion, numeric shorthand, null, and boolean behavior. Do not add a generic schema layer. BACK-694 is moving task identity claims to metadata-based records; inspect its finished implementation after writer release before choosing the smallest targeted read-error propagation change.

Implementation ready for architecture review; source is frozen. Changed only src/markdown/parser.ts, src/file-system/operations.ts, src/core/backlog.ts, and new src/test/malformed-task-dependencies.test.ts. parseTask rejects mapping/nested-array structures before coercion using one dependency-specific error; primitive/null/boolean behavior is unchanged. Explicit missing-index reads ask the existing filesystem reader to surface a parse failure while keeping the index authoritative (a successful diagnostic read does not override its not-found result). saveTask propagates the same error when re-reading existing source, blocking stale loaded objects.

Before/after real CLI evidence on Bun 1.3.14: task edit TASK-2 --title 'dependent v2' returned exit 0 and 'Updated task TASK-2' for all three malformed forms before the fix; mapping entry became '[object Object]', nested array became 'TASK-1,TASK-3', and whole-field mapping became []. After the fix each returned exit 1 with 'Invalid dependencies in task TASK-2' plus entry/field context, no success output, and byte-for-byte unchanged Markdown. Temporary reproduction directories: /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/back696-repro-yJfKsh (before) and /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/back696-repro-E3zH2y (after).

Validation with /tmp/back694-ci-runtime/bun 1.3.14: 161 tests passed across markdown, cli-dependency, dependency, filesystem-task-cache, task-edit-preservation, cli-custom-prefix-id-resolution, atomic-task-edit, task-identity-index, and malformed-task-dependencies. The 13 new tests cover repeat parser failures, entry position, scalar defaults, real CLI exact-byte preservation, warmed Core mutations for both read modes, stale-object save protection, healthy reads/edits, and valid string/numeric dependency edits. After the final simplification, the focused plus identity suites passed again (18 tests), bun x tsc --noEmit passed, whole-tree bun run check . passed (434 files), and git diff --check passed.

Subtraction review: kept validation inside the existing parser; no serializer changes, schema framework, new loader, list-error policy, or adapter-specific checks. Restricted the extra filesystem read to diagnosis so it cannot introduce a second task-resolution authority. Inspected BACK-694 checkpoint identity changes; those apply to archived ID claims and do not replace this active-task parse path. No archive/delete changes, commits, index/ref edits, pushes, or public actions. Acceptance criteria remain unchecked pending full-context review.

Architecture review correction: reproduced two in-flight getTask root-switch failures with a gated old-filesystem diagnostic read. An old missing lookup returned null, and an old malformed lookup threw its parse error after switching to a project with a healthy task. Both new regressions failed before correction. Reused the existing projectChanged() predicate and retry loop after resolved diagnostic reads and in their catch path. No new root abstraction.

Final proof on Bun 1.3.14: earlier broad focused run passed 161 tests in 9 files. After the review correction, malformed-task-dependencies plus shared-branch-task-loader passed 39 tests (132 assertions), including both previously failing root-switch cases. TypeScript passed after correction; Biome passed for all four owned source/test files after correction (whole-tree Biome had passed earlier); git diff --check passed. The focused new regression file now has 15 tests. Second architecture review accepted the corrected implementation unchanged: all six architecture answers keep, no blockers, no worthwhile simplification. All three AC and all three DoD items have direct proof from these checks.

Finalization authorized scoped direct publication to main. Only the four recorded source/test paths and this task record belong in the commit. No further implementation changes are required.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rejected structured dependency values before string coercion can corrupt Markdown. Explicit task reads report the dependency error, stale task saves cannot overwrite malformed source, and project switches retry diagnostic reads. Existing scalar conventions and healthy task behavior remain unchanged. Verified the real CLI before/after reproduction with exact source-byte preservation, 161 regression tests before review correction, and 39 focused tests after correction, plus TypeScript, Biome, and diff checks. Architecture review approved the final implementation; no follow-up is required for this scope.
<!-- SECTION:FINAL_SUMMARY:END -->
