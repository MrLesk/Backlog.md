---
id: BACK-556.1
title: Commit only the paths each automatic operation selects
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:46'
updated_date: '2026-07-29 22:23'
labels:
  - git
dependencies: []
parent_task_id: BACK-556
priority: high
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several production automatic-commit paths stage a whole directory or a file move and then call broad `commitChanges()`. Unrelated entries already present in the real index are therefore swept into a Backlog commit, so an automatic commit can contain files the user never intended to commit.

Convert every production automatic-commit path to the selected-path commit pipeline, so each automatic commit contains exactly the paths the operation touched. Known broad callers include promote/demote, bulk reorder/update, archive/complete, draft lifecycle, documents, decisions, and agent-instruction updates. Archive and milestone rename additionally move files, so the full set of source and target paths belongs in the commit.

Pre-existing unrelated staged and unstaged paths, plus unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, must remain outside the automatic commit and retain their prior real-index and worktree state. Post-commit hooks run against the real index and worktree, so mutations they make there persist according to normal Git semantics rather than being rolled back as temporary-index leakage.

This is a correctness fix that stands on its own under the current default automatic-commit behavior; it does not depend on any amend support. It is also a prerequisite for BACK-556, because a commit can only be marked Backlog-owned if Backlog controls exactly what it contains.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every production automatic-commit path commits only the files selected for that operation, covering tasks, drafts, bulk updates and reorders, lifecycle moves, milestones, documents, decisions, and agent-instruction updates.
- [ ] #2 Pre-existing unrelated staged and unstaged paths, and unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, remain outside the commit and retain their prior real-index and worktree state; mutations made by post-commit hooks against the real index and worktree persist according to normal Git semantics.
- [x] #3 Operations that move files, such as archive and milestone rename, commit the complete set of source and target paths the operation touched, with no stray additions.
- [ ] #4 Existing selected-path robustness is preserved: temporary-index isolation, owned-index reconciliation, retries, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates.
- [x] #5 Merge, rebase, cherry-pick, and revert in-progress guards continue to fail closed without moving HEAD, corrupting operation metadata, or consuming unrelated index entries.
- [ ] #6 Tests cover unrelated index and worktree state, pre-commit and commit-message hook staging isolation, post-commit real-index mutations, file-move operations, custom backlog roots, linked worktrees, and projects without Git.
- [x] #7 Promotion and demotion use one canonical lifecycle implementation that returns the complete touched-path result, while duplicate task IDs continue to raise the explicit ambiguity diagnostic.
- [x] #8 Title-changing draft updates return and commit both the previous and replacement paths in new and amend-own modes, leaving no duplicate in HEAD or unstaged deletion.
- [x] #9 Lifecycle target validation and unexpected write failures propagate their actionable original errors; null/false is reserved for a genuinely absent source.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one Core helper that stages an operation's deduplicated path set and delegates to the existing selected-path Git commit pipeline.
2. Convert broad automatic commit callers for bulk task updates, task/draft lifecycle moves, decisions, documents, and agent instructions to pass exact source/target/output paths; preserve milestone callers already using commitFiles.
3. Adjust internal filesystem/core return values only where an operation must report every touched source and target path, without adding external public API surface.
4. Add focused regression coverage for unrelated index/worktree state, lifecycle moves, pre/message-hook isolation, post-hook mutations, custom roots, linked worktrees, and filesystem-only projects.
5. Run scoped tests, TypeScript, Biome, then record evidence and finalize BACK-556.1 before activating BACK-556.2.

6. Remove Core/FileSystem lifecycle duplication by returning source/target paths from the canonical filesystem mutation; preserve AmbiguousTaskIdError and cover it with a regression.

7. Return all touched paths from draft upserts and distinguish absent-source results from validation/write failures in lifecycle result helpers; add new/amend rename and invalid-field regressions.

8. Route browser milestone creation through the shared Core selected-path mutation and cover enabled/disabled and both commit modes.

9. On every commit-tree CAS retry, compare selected paths between the prior and newly observed base; abort or safely incorporate differences instead of overlaying stale frozen entries. Cover same-path temporary-index races in new and replacement intents.

10. Make selected-tree conflict errors non-retryable through addAndCommitTaskFile, or carry the original selected-tree baseline through outer retries. Cover production new/amend-own task wrappers with plumbing-only concurrent same-path commits that preserve caller worktree/index bytes.

11. Guard the expected symbolic HEAD target and the intended branch OID in one atomic ref transaction so a same-SHA branch switch cannot redirect the selected-path commit; cover the production commit path without changing caller worktree/index bytes.

12. Acquire the real index lease before HEAD in Git lock order, then re-read selected entries and operation state inside the protected finalization boundary. Extend race regressions to same-SHA hard reset and merge/autostash windows without losing caller or concurrent bytes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one exact-path staging/commit path and converted bulk task updates, task/draft lifecycle moves, decisions, documents, and agent-instruction writes; existing milestone mutations remain on commitFiles. FileSystem decision writes now report every removed/created path, and ContentStore preserves that result.

Verification: 217 tests passed across auto-commit, core, CLI lifecycle, TUI selected-path robustness, MCP milestones, agent instructions, ContentStore, and the new selected-path suite (881 assertions). The new suite directly verifies exact source/target commits, unrelated staged and unstaged preservation, pre/message-hook isolation, post-hook real-index mutations, custom roots, linked worktrees, and no-Git projects. bunx tsc --noEmit, focused Biome, and git diff --check passed.

Holistic correction: consolidated Core promotion/demotion onto FileSystem result-returning mutations, retained selected source/target paths, and preserved AmbiguousTaskIdError. Verification: 123 focused tests and the full 1,820-test gate passed.

Holistic pass 2 corrections: draft writes now return previous and replacement paths for exact-path commits in both modes; canonical lifecycle helpers reserve null for missing sources and propagate validation/write errors. Regressions cover renamed draft trees/status and invalid promotion/demotion priority diagnostics. Verification: 144 focused tests passed, then TypeScript, full Biome, and the full suite passed with 1,835 tests and 4 skips.

Pass 3 correction routes browser milestone creation through Core.createMilestone and the selected-path commit pipeline. Integration coverage verifies new, amend-own replacement, forced-new, and disabled behavior. Final focused gate: 171 tests/729 assertions; integrated gate: TypeScript and 348-file Biome clean, 1,841 passed/4 skipped across 205 files.

Pass 9 selected-path CAS correction complete. Each newly observed HEAD is compared against the previous base for all selected tree entries before frozen entries are overlaid. New and amend-own temporary-index races on the same file reject, preserve concurrent HEAD bytes, and retain the caller index bytes. Full gate: 1,856 passed/4 skipped.

Pass 10 production-wrapper race correction complete. addAndCommitTaskFile immediately propagates same-selected-path conflict errors instead of retrying from stale caller content. Plumbing-only concurrent commits prove both new and amend-own wrappers preserve the caller worktree/index while retaining concurrent HEAD content. Focused and integrated gates pass.

Pass 11 final-ref correction complete. The selected-path CAS now leases both the observed symbolic branch identity and expected branch OID: a pre-lock same-SHA switch rejects without moving either branch, and a switch attempted during final ref update is blocked by HEAD.lock. Existing concurrent-HEAD/selected-path tests were moved to the precise pre-lock race boundary and remain green.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @andreas
created: 2026-07-29 09:25
---
Holistic finding M3: Core duplicated promote/demote to recover selected paths and its demotion catch-all converted AmbiguousTaskIdError into false. Consolidate the mutation and preserve the fail-closed identity diagnostic.
---

author: @andreas
created: 2026-07-29 10:55
---
Holistic pass 2 findings H1/M2: draft title updates committed only the new filename, and lifecycle callback validation errors were swallowed as not-found results.
---

created: 2026-07-29 11:58
---
Holistic pass 3 finding H3: browser milestone creation writes through FileSystem directly, so configured automatic commits, selected-path behavior, force-new, and feedback are bypassed.
---

created: 2026-07-29 18:11
---
Pass 9 H1: the CAS retry overlays frozen selected entries onto a newly observed HEAD without detecting that another isolated-index commit changed the same selected path.
---

created: 2026-07-29 20:31
---
Pass 10 H1: direct commitFiles rejects a same-path CAS race, but addAndCommitTaskFile can treat it as a generic retry and resnapshot the stale caller blob over the concurrent HEAD.
---

created: 2026-07-29 21:15
---
Pass 11 H1: update-ref HEAD checks only the expected OID, so a concurrent same-SHA symbolic branch switch can redirect finalization onto a sibling branch.
---

created: 2026-07-29 22:23
---
Pass 12 H2: selected index reconciliation currently precedes HEAD lease acquisition, allowing reset/merge mutations in the remaining window before final ref movement.
---
<!-- COMMENTS:END -->
