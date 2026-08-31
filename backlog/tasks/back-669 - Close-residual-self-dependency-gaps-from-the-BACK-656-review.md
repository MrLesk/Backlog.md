---
id: BACK-669
title: Close residual self-dependency gaps from the BACK-656 review
status: In Progress
assignee:
  - '@Claude'
created_date: '2026-08-31 00:26'
updated_date: '2026-08-31 00:32'
labels:
  - cli
  - bug
dependencies: []
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two residual defects deferred at PR #978 merge, both small: (1) a legacy draft carrying a dangling dependency reference equal to the NEXT allocated task ID slips past validation on promotion — resolveUniqueDependency returns null, the invalid list is ignored on that path, and the unchanged reference is written under the newly allocated ID as a direct self-dependency (demotion has the mirror problem with draft IDs); check references against the allocated target before corpus resolution even when unresolved. (2) doctor --fix bases its final dependency-findings exit status on the pre-repair snapshot, so a self-dependency that the duplicate-ID repair itself resolves still reports remaining findings and exits 1; re-run findDependencyDefects after repairDuplicateTaskIds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Promoting or demoting a record with a dangling reference equal to the allocated ID is rejected; no self-dependency can be written
- [ ] #2 doctor --fix exit status reflects the post-repair corpus
- [ ] #3 Tests cover both scenarios
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In validateDependencies (src/utils/task-builders.ts), move the target self-check before resolveUniqueDependency and compare the raw dependency spelling to target.id with taskIdsEqual, replacing the post-resolution check it subsumes; dangling refs equal to the allocated promotion/demotion ID then fail closed.
2. In doctor --fix (src/cli.ts), re-run findDependencyDefects after repairDuplicateTaskIds and gate the final dependency-findings message and exit code on the repaired corpus.
3. Tests: promotion and demotion with a dangling reference equal to the next allocated ID are rejected; doctor --fix exits 0 when the duplicate-ID repair resolves the self-dependency finding.
4. Proof: bunx tsc --noEmit, bun run check ., bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved the self-dependency check in validateDependencies ahead of corpus resolution, comparing the raw input to target.id with taskIdsEqual (the same predicate the corpus filter uses, so it subsumes the removed post-resolution check). doctor --fix now re-runs findDependencyDefects after repairDuplicateTaskIds and gates the final dependency message/exit on the repaired corpus. Tests: promotion and demotion with a dangling ref equal to the allocated ID are rejected and write nothing; doctor --fix exits 0 when the rename resolves the self-dependency. tsc, biome, and the two touched test files are green; full suite running.
<!-- SECTION:NOTES:END -->
