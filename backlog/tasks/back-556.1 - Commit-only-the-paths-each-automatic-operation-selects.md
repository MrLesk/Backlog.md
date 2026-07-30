---
id: BACK-556.1
title: Commit only the paths each automatic operation selects
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:46'
updated_date: '2026-07-30 04:22'
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
- [x] #2 Pre-existing unrelated staged and unstaged paths, and unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, remain outside the commit and retain their prior real-index and worktree state; mutations made by post-commit hooks against the real index and worktree persist according to normal Git semantics.
- [x] #3 Operations that move files, such as archive and milestone rename, commit the complete set of source and target paths the operation touched, with no stray additions.
- [x] #4 Existing selected-path robustness is preserved: temporary-index isolation, owned-index reconciliation, retries, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates.
- [x] #5 Merge, rebase, cherry-pick, and revert in-progress guards continue to fail closed without moving HEAD, corrupting operation metadata, or consuming unrelated index entries.
- [x] #6 Tests cover unrelated index and worktree state, pre-commit and commit-message hook staging isolation, post-commit real-index mutations, file-move operations, custom backlog roots, linked worktrees, and projects without Git.
- [x] #7 Promotion and demotion use one canonical lifecycle implementation that returns the complete touched-path result, while duplicate task IDs continue to raise the explicit ambiguity diagnostic.
- [x] #8 Title-changing draft updates return and commit both the previous and replacement paths in new and amend-own modes, leaving no duplicate in HEAD or unstaged deletion.
- [x] #9 Lifecycle target validation and unexpected write failures propagate their actionable original errors; null/false is reserved for a genuinely absent source.
- [x] #10 Named finalization detects an exact-branch reflog ABA in the remaining post-validation/pre-CAS window and rejects or safely rolls back without consuming the caller selected index/worktree state.
- [x] #11 On Git without update-ref transaction commands, selected-path named new/start-owned commits retain expected-old-OID CAS and caller byte preservation; amend-own never performs an unlocked replacement and instead builds a new commit.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

13. Preserve reference-transaction hook semantics around the leased selected-path ref movement: real context, one logical transaction, prepared veto before movement, committed/aborted completion, and no duplicate no-op transaction.

14. Re-run the complete selected-path final lease validator after reference-transaction prepared returns and before any ref/HEAD write. Cover prepared-hook operation-marker mutation across new/start-owned, amend-own replacement, and detached finalization without losing caller index/worktree bytes.

15. Add a typed non-retryable reference-transaction prepared-veto error and propagate it through the production task wrapper while retaining documented transient pre-commit retries. Regress one-shot and persistent vetoes at addAndCommitTaskFile.

16. Preserve ReferenceTransactionVetoError through commitFiles before its changed-HEAD CAS retry decision, and add a production wrapper regression where prepared moves the branch then vetoes. Add explicit bounded timeouts only to the two reviewer-observed multi-commit/hook tests.

17. Route editTaskInTui persistence through the shared selected-path task commit after editor content and updated_date are finalized. Preserve cancellation/no-change behavior and verify only the task path is committed while unrelated index/worktree bytes remain intact.

18. Reconcile actual post-editor path/content before selected-path staging: valid modify-then-fail bytes follow the normal task commit, while missing/moved or invalid-identity content fails with explicit uncommitted recovery guidance. Add direct Git/state regressions.

19. Extend the selected-path final lease with exact branch-reflog continuity across the final ref update. Add a deterministic alternate-Git-context ABA immediately before the synthetic CAS, then prove caller staged/worktree bytes and manual branch history survive without a successful amendment.

20. Add capability-gated named finalization. Use the prepared target-ref transaction where supported; on legacy Git, deopt ownership before tree/parent construction and use the existing expected-OID update only for new/start-owned commits. Simulate Git 2.27 while proving default new and amend-own degradation preserve selected index/worktree state and commit correct trees.
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

Pass 12 final lease now covers both real index and HEAD in Git lock order. Selected entries and operation markers are re-read while both locks are held; reset, operation-marker, and index-only races reject before ref movement. Detached same-SHA attachment and named same-SHA switches preserve both reachable and caller bytes.

Pass 13 reference-transaction correction preserves selected-path robustness while honoring real-context Git hook vetoes. A four-scenario regression covers named/detached veto and success lifecycles, exact event counts, real symbolic/detached HEAD context, unchanged vetoed refs and committed selected bytes. Focused and integrated gates pass.

Pass 14 selected-path lease correction complete. The exact final HEAD/lease validator runs both before and after prepared, closing its mutation window for start-owned, replacement, and detached commits. Regression coverage creates MERGE_HEAD from prepared in all three paths and proves prepared/aborted ordering, unchanged HEAD/tree, and preserved staged/worktree selected bytes. Focused and integrated gates pass.

Pass 15 wrapper retry correction complete. ReferenceTransactionVetoError distinguishes authoritative prepared rejection from intentionally retryable transient pre-commit errors. Production addAndCommitTaskFile one-shot/persistent veto regressions prove one prepared/aborted lifecycle, unchanged owned tip, and preserved caller index/worktree bytes; the existing transient pre-commit retry regression remains green.

Pass 16 CAS-loop and reliability corrections complete. Typed prepared vetoes propagate before commitFiles inspects hook-driven HEAD movement. The production regression uses an alternate Git-dir sharing common refs to move main during prepared, then proves no retry, no committed event, wrapper rejection, and preserved caller index/worktree bytes. Explicit 20-second bounds stabilize the identified repeated-replacement and hook-lifecycle tests.

Pass 17 production-path coverage complete. TUI external-editor task changes now use the shared selected-path task wrapper after updated_date finalization. Regression coverage proves the edited task is committed while unrelated staged and unstaged files retain caller index/worktree state; malformed current config prevents editor launch and all writes.

Pass 18 external-editor reconciliation complete. Valid modify-then-fail bytes use the same selected-path commit and warning feedback. Identity collision/malformed content never reaches metadata, ContentStore, staging, or commit. Deleted/renamed paths produce explicit uncommitted recovery errors with HEAD unchanged and filesystem/Git state preserved for manual repair. Focused and integrated gates pass.

Pass 19 H1 reopens final selected-path robustness: expected-OID CAS cannot distinguish an ownership-closing target-branch old→parent→old reflog transition after validation.

Pass 19 selected-path final lease complete. The target branch transaction is prepared and locked before complete lease revalidation, so an expected-OID CAS cannot overlook same-OID reflog ABA. Regression preserves selected caller index/worktree bytes and the original reachable tree while retaining concurrent manual reflog history. Focused 63/473 and integrated 1,874/8,333 gates pass.

Pass 20 M2 reopens compatibility: update-ref start/prepare/commit arrived in Git 2.28, but all named automatic commits currently invoke it without a capability gate or fallback.

Pass 20 legacy selected-path finalization complete. Simulated Git 2.27 preserves default new and start-owned named expected-OID commits; amend-own deopts before parent/message construction and creates a new child rather than an unlocked replacement. Selected trees, commit ancestry, ownership reporting, and repeated commit counts are asserted. Focused 65/492 and integrated 1,876/8,352 gates pass.
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

created: 2026-07-29 23:15
---
Pass 13 H1: synthetic named updates and manual detached writes bypass real-context reference-transaction vetoes; the later HEAD reflog no-op is too late and its failure is ignored.
---

created: 2026-07-29 23:54
---
Pass 14 H1 reopens final selected-path robustness and operation guards: prepared hooks currently execute after lease validation and can invalidate the protected state before movement.
---

created: 2026-07-30 00:29
---
Pass 15 H1 reopens wrapper retry robustness: prepared vetoes are generic errors and can be retried into a successful production task commit.
---

created: 2026-07-30 01:08
---
Pass 16 H1/M2: typed veto finality is lost inside the inner CAS loop when the vetoing hook moves HEAD, and two Git integration tests need explicit outer bounds consistent with their work.
---

created: 2026-07-30 01:49
---
Pass 17 H1 reopens production path completeness: board/list external-editor task writes do not currently enter the selected-path automatic commit pipeline.
---

created: 2026-07-30 02:29
---
Pass 18 H1/M2 reopens external-editor selected-path completeness: invalid identity can be committed under the wrong descriptor, while failure/deletion/rename can persist outside the automatic commit path.
---
<!-- COMMENTS:END -->
