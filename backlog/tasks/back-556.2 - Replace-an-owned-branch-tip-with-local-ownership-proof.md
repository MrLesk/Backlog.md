---
id: BACK-556.2
title: Replace an owned branch tip with local ownership proof
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:46'
updated_date: '2026-07-30 06:30'
labels:
  - git
dependencies:
  - BACK-556.1
parent_task_id: BACK-556
priority: medium
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the Git layer the ability to replace the current branch tip with a commit that carries the previous commit content plus newly selected paths, together with a repository-local way to prove that the tip was created by Backlog itself.

This is the safety-critical core of BACK-556. It covers the replacement mechanics, the message rebuild, the ownership evidence, and every boundary that must refuse a replacement. It deliberately excludes configuration and user-facing wiring, which arrive in BACK-556.3; until then nothing in the product replaces a commit.

Ownership must be exact-SHA based and repository-local, and must fail closed whenever evidence is missing, stale, malformed, or ambiguous. Ownership tracking must create no Git refs, notes, commits, trees, or blobs, so it contributes no ownership-only object reachable through `git rev-list --all --objects`; tests must distinguish intended branch-tip graph changes from the evidence itself. It must not introduce any network operation. The exact evidence format, the rule that matches a candidate `HEAD` against it, and the definition of stale evidence must be specified in one place and covered by tests rather than left to inference. A newly created commit is owned only when it lands on a named branch and valid evidence for its exact SHA is successfully recorded. If `HEAD` is detached or the selected evidence channel cannot record ownership, such as a branch with no usable reflog while automatic reflog creation is disabled, commits created in that state remain unowned and repeated operations cannot enter the replacement path.

A replacement is owned on the same terms as a new commit: it must record valid evidence for its own new SHA. Recording evidence only when a sequence starts would collapse the feature into amend-once, because the tip SHA no longer matches the recorded evidence after the first replacement.

Replacement eligibility also requires that the candidate tip is not reachable from any remote-tracking ref, any local branch other than the current branch, or any tag, including annotated tags. This covers refs pointing directly to the candidate and refs pointing to descendants that retain it in history. A linked worktree parked at the candidate with a detached `HEAD` is deliberately not checked; that is an accepted and documented limit, recorded in BACK-556 alongside the two publication limits.

The message is rebuilt rather than appended to. Backlog owns the subject line plus one delimited region in the body that lists the operations the commit contains. On each replacement it parses its operation lines out of the previous region, merges in the new operation, collapses duplicates so each distinct operation appears once, and regenerates the region and subject from that list. Content outside the region is preserved verbatim, and Backlog never re-renders on top of its own previous output.

`amend-own` is not supported alongside hooks that modify the commit message. This slice does not detect or prevent that combination; BACK-556.3 documents that a non-idempotent message hook appends its output once per amend.

A replacement keeps the original parent set, author identity, and author date, but applies the effective signing configuration, format, and key available when the replacement runs, as a normal new automatic commit does. It does not inherit the signed or unsigned state of the commit it replaces. A required-signing or missing-key failure must leave `HEAD` unchanged.

The existing selected-path robustness stays intact: temporary-index isolation, owned-index reconciliation, retries, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates. Pre-commit and commit-message hooks use the isolated commit index so unrelated staging cannot leak into the commit or real index. Post-commit and post-rewrite run against the real index and worktree, and mutations they make there persist according to normal Git semantics. Replacement must additionally match the observable Git rewrite lifecycle, including `post-rewrite` with the old and new commit IDs and the `amend` argument. As in Git, both post hooks are notifications whose failure must not fail the operation.

See BACK-556 for the full ownership and safety contract, including the accepted limits of local-only publication and worktree detection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Git layer can replace the current branch tip with a commit that keeps the original parent set, author identity, and author date, refreshes committer metadata and commit ID, and uses the effective signing configuration, format, key, and failure behavior at replacement time rather than inheriting the signature state of the commit it replaces.
- [x] #2 The replacement commit contains the tree of the commit it replaces plus only the newly selected paths.
- [x] #3 The replacement message is rebuilt rather than appended to: Backlog parses its operation lines out of the delimited region of the previous commit, merges in the new operation, collapses duplicates so each distinct operation appears once regardless of position, and regenerates the region and the subject from that list. Content outside the region is preserved verbatim and Backlog never re-renders on top of its own previous output.
- [x] #4 A commit holding one operation keeps that operation subject unchanged. From the second distinct operation onward the subject is factored: operations sharing a verb and entity type list their IDs, the line elides past a 72 character budget with a plus N more suffix, and mixed verbs fall back to a count of distinct operations.
- [x] #5 Ownership is decided from exact repository-local provenance for the current HEAD SHA, never from author, changed-path, or subject heuristics.
- [x] #6 The evidence format, the rule that matches a candidate HEAD against it, and the definition of stale evidence are specified in one place and covered by tests.
- [x] #7 Cloned, legacy, manually created, manually amended, and reset commits, and any tip whose ownership evidence is missing, stale, malformed, or ambiguous, are reported as not owned.
- [x] #8 Ownership tracking creates no Git refs, notes, commits, trees, or blobs and contributes no ownership-only object to git rev-list --all --objects; tests separately account for the intended automatic commit and branch-tip graph changes.
- [x] #9 A tip is reported as not owned when HEAD is detached, is a merge commit, is reachable from a remote-tracking ref, or is reachable from any local branch other than the current branch or any tag, including annotated tags and both refs that point directly to the candidate and refs that point to a descendant, using local refs only and performing no network operation.
- [x] #10 A new commit is reported as owned only when it lands on a named branch and valid evidence for its exact SHA is successfully recorded. Commits created with detached HEAD or while the selected ownership channel cannot record evidence, including a branch with no usable reflog while automatic reflog creation is disabled, remain unowned, and repeated operations in either state cannot enter the replacement path.
- [x] #11 A replacement commit records valid ownership evidence for its own new SHA on the same terms as a newly created commit, so an amendable sequence survives repeated replacements. If that recording does not succeed, the sequence ends at that commit and the next operation creates a new commit.
- [x] #12 After a failed expected-old-SHA update, ownership and eligibility are re-evaluated, and a concurrent non-Backlog commit is never overwritten.
- [x] #13 Concurrent changes to the selected paths are either incorporated into the commit or reported as an error, and no selected change is lost silently.
- [x] #14 The replacement path runs pre-commit, prepare-commit-msg with message as its source argument, commit-msg, and post-commit consistently with Git amend semantics, and invokes exactly one post-rewrite amend carrying the old and new commit IDs, while the new-commit path invokes no post-rewrite. Pre-commit and commit-message hook staging remains isolated; post-hook mutations against the real index and worktree persist.
- [x] #15 post-commit and post-rewrite are notifications: a failing post hook does not fail the operation or move HEAD.
- [x] #16 bypassGitHooks and the legacy hook-runner path behave the same for replacements as for new commits.
- [x] #17 Merge, rebase, cherry-pick, and revert in-progress guards fail closed without moving HEAD or consuming unrelated index entries.
- [x] #18 Git-level tests cover repeated replacement sequences with evidence re-recorded at each step; subject shapes for single, factored, elided, and mixed-verb cases; duplicate collapsing; region parsing when a hook has appended content outside the region; repeated detached and evidence-unavailable new commits; root commits; manual and publication boundaries; local branches, lightweight tags, and annotated tags pointing directly to candidates and to descendants; pre and message hook isolation, post-hook real-index mutations, and failing post hooks; signed-to-unsigned and unsigned-to-signed configuration transitions; required-signing failures; linked worktrees and branch switches; and concurrent branch movement.
- [x] #19 Legacy new-mode commits contain no rolling-operation region or ownership evidence; only an amend-own sequence start or replacement records exact-SHA ownership, and switching from new to amend-own cannot rewrite the pre-opt-in tip.
- [x] #20 After message hooks, replacement eligibility is revalidated against exact reflog state, Git-operation guards, and all containing refs; hook-created refs and same-SHA away-and-back changes fail closed.
- [x] #21 Ownership is branch-local: switching away and returning to an otherwise unchanged safe branch intentionally resumes its amendable sequence, and documentation plus tests state that behavior.
- [x] #22 Rolling messages store structured operation descriptors so production task, draft, document, decision, milestone, and agent messages produce stable factored subjects without parsing incidental English display strings.
- [x] #23 Document, decision, and agent-instruction upserts record the real create/add versus update action, so distinct operations never collapse under one inaccurate descriptor.
- [x] #24 Named and detached finalization exposes exactly one logical reference-transaction hook lifecycle in the real repository/HEAD context: prepared runs before movement and can veto it, committed follows success, aborted follows veto or failed movement, and internal ref/reflog plumbing does not duplicate the transaction.
- [x] #25 Final named-branch movement preserves exact ownership-reflog continuity: any target-branch reflog transition after the last validation, including same-OID ABA, prevents a replacement from being reported owned and cannot be overwritten by the automatic CAS/rollback path.
- [x] #26 When target-ref transactions are unsupported, amend-own conservatively treats an otherwise owned tip as non-owned before parent/message construction, creates a normal new owned-sequence start through expected-OID CAS, and never performs an unlocked replacement.
- [x] #27 Reference-transaction and post-rewrite stdin reach hooks through a capability-correct runner on Git 2.36–2.39 and 2.40+, while Git 2.27 participates in atomic target-ref transaction replacement rather than unnecessary degradation.
- [x] #28 Worktree HEAD reflog visibility is restored only through a hook-suppressed prepared HEAD transaction that validates the original branch identity while HEAD and its target ref are locked; no other branch can receive forged ownership evidence during synchronization.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define ownership evidence as a versioned marker on the newest reflog entry of the exact current named branch SHA; missing, stale, malformed, detached, and reflog-unavailable cases fail closed without refs or Git objects.
2. Extend commitFiles with an optional Git-layer amend-owned mode that recomputes ownership and local reachability on every compare-and-swap retry, rejects merges/remotes/other branches/tags, and records evidence for every new replacement SHA.
3. Build rolling messages through one pure utility: one delimited JSON-safe operation region, exact duplicate collapsing, preserved outside text, single/factored/elided/mixed subjects, and malformed-region fallback to a new commit.
4. Preserve replacement parents and author metadata while using current signing configuration; run prepare-commit-msg with message, post-commit, and exactly one best-effort post-rewrite amend mapping against the real index.
5. Add Git-level tests for evidence, repeated/root replacements, all safety boundaries, refs/reachability, hooks/bypass/legacy/signing, concurrency, selected-path races, linked worktrees, and graph visibility; run TypeScript, Biome, and focused suites before finalizing.

6. Introduce explicit new/start-owned/replace-owned intent and structured operation descriptors. Revalidate branch/reflog/ref/operation state after hooks, including same-SHA ABA. Document and test intentional branch-local resume after switching away and back.

7. Thread explicit create/update semantics through document, decision, and instruction upserts and verify production add-then-update rolling regions.

24. Emit per-file agent-instruction structured operations with each file’s actual Add/Update action so same-action different files and mixed-action batches remain distinct in rolling metadata.

25. Extend selected-path CAS coverage to concurrent same-path commits for both new and amend-own replacement intents, proving no reachable selected content is silently lost.

26. Prove same-selected-path conflict rejection survives the production task commit wrapper and cannot be reset by its outer retry loop in either new or amend-own mode.

27. Snapshot branch identity per CAS attempt and atomically verify symbolic HEAD still targets that exact branch while updating only its expected OID. Add a same-SHA sibling-branch switch regression proving neither branch is amended or marked owned after identity changes.

28. Lease detached HEAD identity as well as named branches. Acquire index then HEAD locks, revalidate detached/named identity, selected index entries, operation markers, ownership reflog, and containing refs under that lease, then perform the expected-OID update. Add detached same-SHA switch plus reset/merge/tag race coverage.

29. Drive reference-transaction prepared/committed/aborted manually through the real worktree hook runner while locks are held, suppress automatic hook execution on synthetic/internal plumbing, and cover named/detached veto plus success event counts/context. Deduplicate normalized initial, existing, and appended operation lists before subject/body rendering.

30. Treat the reference-transaction prepared callback as a mutation boundary: after it succeeds, revalidate exact HEAD identity/OID plus the full lease callback before named/detached movement; on any change, invoke aborted and leave HEAD unchanged. Regress MERGE_HEAD creation for start-owned, amend-own replacement, and detached commits, including hook event order and preserved bytes.

31. Make prepared reference-transaction rejection an explicit non-retryable error across commitFiles and addAndCommitTaskFile. Cover one-shot and persistent production wrapper vetoes, asserting prepared/aborted only, no committed event, no ref movement, and preserved staged/worktree content.

32. Throw ReferenceTransactionVetoError before commitFiles evaluates changed HEAD for CAS retry. Regress a one-shot prepared hook that uses hook-disabled update-ref to move main and reject: one prepared/aborted lifecycle, no second prepared/committed transaction, wrapper rejection, and preserved caller bytes. Bound the identified repeated-replacement and amend-hook lifecycle tests.

33. Close final-window ownership ABA by snapshotting the exact newest target-branch reflog record under final validation and enforcing continuity through ref movement. Prefer atomic target-ref protection where compatible with real-context reference-transaction semantics; otherwise verify the new automatic marker directly follows the captured record and expected-OID rollback only when safe, leaving a non-owned/manual boundary. Cover successful replacement, same-SHA no-op reflog mutation, and old→parent→old ABA through an alternate hook-disabled Git context.

34. Cache transaction capability from Git version/capability detection. Before replacement construction, discard owned eligibility when target-ref preparation is unavailable; finalize the resulting new/start commit through legacy expected-OID CAS with synthetic hooks suppressed and preserve retries. Cover Git 2.27 default new success and repeated amend-own new commits, and retain modern atomic ABA coverage.

35. Correct Git capability thresholds: target-ref start/prepare/commit at 2.27, hook run at 2.36, and hook run --to-stdin at 2.40. Use legacy hook execution whenever input is required below 2.40, keep bypass and best-effort post semantics, and cover event bytes/counts plus actual replacement/degradation boundaries.

36. Reuse prepared update-ref transaction plumbing for real-worktree HEAD no-op synchronization on Git 2.27+. Validate exact original branch/new SHA in the prepared callback, tolerate abort as display/recovery best effort, and retain the target branch ownership marker. Test a switch plus manual original-branch boundary before synchronization, then verify sibling reflog is non-owned and the next sibling amend-own creates a new child.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented versioned branch-reflog ownership evidence (`backlog:auto-commit/v1`) whose newest entry must match the exact current branch tip. Evidence adds no refs or objects and fails closed for detached, stale, malformed, missing, reflog-unavailable, merge, remote, other-branch, and tag-reachable tips.

Extended commitFiles with optional amend-owned replacement. Each CAS retry recomputes eligibility; replacements preserve original parents and author metadata, use current signing configuration, re-record ownership for the new SHA, and invoke prepare-commit-msg/commit-msg/post-commit plus best-effort post-rewrite amend semantics against the correct index.

Added one pure rolling-message implementation with a delimited JSON-safe operation region, duplicate collapse, preserved outside content, and single/factored/elided/mixed subject behavior. Verification: 123 focused tests passed (501 assertions) before the final message-preservation refinement; focused follow-up tests and bunx tsc --noEmit also passed. Coverage includes repeated/root replacement, evidence loss, manual/clone/reset boundaries, direct/descendant remote/branch/lightweight/annotated refs, operation guards, hooks/bypass/legacy, signing transitions/failures, concurrent HEAD movement, linked worktrees, selected-index races, and graph visibility. Biome and git diff --check passed.

Holistic correction implemented explicit new/start-owned/amend-own intent, v2 structured operation descriptors with v1 migration, post-hook operation/ref/reflog revalidation including same-SHA ABA, and intentional branch-local resume documentation/tests.

Holistic pass 2 correction: document, decision, and agent-instruction upserts derive Add versus Update before commit metadata is built. Production regressions assert all six distinct descriptors remain in one owned rolling region. Verification: 144 focused tests passed, then TypeScript, full Biome, and the 1,835-pass full suite.

Pass 6 correction emits a batch of per-file instruction operations, each with its real Add/Update action and filename identifier. Sequential same-action files and mixed-action single batches retain all distinct descriptors. Expanded gate: 145 tests/1,557 assertions; integrated gate: 1,846 passed/4 skipped.

Pass 9 concurrency contract restored: update-ref retries now combine ownership/ref revalidation with selected-tree conflict detection. Same-path races in both new and replacement intents fail closed without losing either reachable concurrent content or staged caller content. Owned replacement suite and the 1,856-test integrated gate pass.

Pass 10 concurrency coverage now crosses the production addAndCommitTaskFile wrapper in both intents. A private temporary index constructs and advances a concurrent same-path commit without changing caller bytes; the typed selected-path conflict remains non-retryable and both reachable concurrent content and staged caller content survive.

Pass 11 branch-identity race is closed. Per-attempt branch snapshots feed owned eligibility and finalization; named-branch updates hold the exact worktree HEAD lock, recheck its symbolic target, and use an isolated Git-dir view of common refs to CAS only that branch without lock recursion. Regressions prove same-SHA switches reject before the lease and cannot occur during it, with both branch tips, worktree, and index preserved.

Pass 12 Git safety lease is complete. Detached HEAD is verified and atomically replaced through its held lock; named branches use the exact expected branch/OID under index+HEAD leases. Ownership/reflog, operation markers, selected index entries, and containing refs are revalidated before update. Sharing created during branch update triggers expected-OID rollback and a non-ownership reflog boundary. Regressions cover detached attachment, same-SHA reset, tag, operation, index, switch-during-update, and sharing-during-update.

Pass 13 hook/message correction complete. The final lease invokes prepared with the exact old/new/ref tuple through the real worktree hook runner before movement; vetoes abort without moving named or detached HEAD; success emits one committed event; failed movement emits aborted; synthetic branch CAS, rollback, and HEAD-reflog restoration suppress automatic duplicate hook events. Whole-list deduplication now repairs duplicate initial and pre-existing v1/v2 operations before rendering. Focused gate: 59 tests/425 assertions; integrated gate: 1,865 passed/4 skipped/0 failed with 8,254 assertions.

Pass 14 hook-boundary correction complete. A shared validateHeadAndLease callback verifies exact identity/OID and all caller invariants immediately after prepared and before named CAS or detached HEAD replacement. Prepared-created MERGE_HEAD rejects start-owned, amend-own replacement, and detached finalization with exactly prepared then aborted, no movement, and no ownership recording. Focused gate: 60 tests/446 assertions; integrated gate: 1,866 passed/4 skipped/0 failed with 8,275 assertions.

Pass 15 veto finality complete. Prepared rejection is wrapped after aborted notification and propagated without production-wrapper retry. One-shot and persistent hooks both prove exact prepared/aborted-only events, no committed event, no ref movement, and preserved staged/worktree selected content. Expanded focused gate: 62 tests/461 assertions; integrated gate: 1,867 passed/4 skipped/0 failed with 8,287 assertions.

Pass 16 veto CAS finality complete. commitFiles now throws ReferenceTransactionVetoError before changed-HEAD retry. A one-shot prepared hook advances main through an isolated hook-disabled ref context and rejects; coverage proves prepared/aborted only, no second transaction, wrapper failure, hook-owned branch movement retained, and staged/worktree selected bytes preserved. Focused gate: 62/465; full owned suite: 26/237; integrated gate: 1,868 passed/4 skipped/0 failed with 8,294 assertions.

Pass 19 H1: target-branch ownership/reflog can change after final validation because only index.lock and worktree HEAD.lock are held. A deterministic alternate-context old→parent→old ABA immediately before internal update-ref still returned amended=true and placed a new ownership marker after manual reflog entries. This violates reset boundaries and exact ownership continuity.

Pass 19 exact reflog continuity complete. A hook-suppressed update-ref --stdin prepare owns refs/heads/* before the final exact ownership snapshot check; commit occurs without releasing that lock, while the real-context hook lifecycle remains externally singular. Alternate-context old→parent→old movement in the former final gap is observed after lock acquisition and aborts without a replacement/rollback or loss of manual history. Existing repeated/root/evidence/hook/symbolic-HEAD/late-sharing scenarios remain green. Focused 63 tests/473 assertions; integrated 1,874 passed/4 skipped/0 failed, 8,333 assertions.

Pass 20 M2: modern final target locking is correct but unconditional. Git 2.27 rejects update-ref stdin start, so even default mode can leave filesystem/index mutation with commit failure; legacy amend-own must degrade rather than replace without the atomic ownership lease.

Pass 20 legacy ownership fallback complete. Cached Git capability detection enables atomic target-ref transactions at 2.28+; older Git never constructs an owned replacement, but normal expected-OID new/start commits and reflog evidence continue. Simulated 2.27 coverage proves default new success, sequence start ownership, and repeated amend-own degradation to new commits with correct parents/trees. Modern final-window ABA/hook coverage remains green. Focused 65/492; integrated 1,876 passed, 8,352 assertions.

Pass 21 H1/M2 corrects two independent capabilities: the current legacy-hook test does not exercise --to-stdin rejection on 2.36-2.39, and the 2.27 transaction degradation test asserts a historically incorrect boundary.

Pass 21 capability boundaries complete. Independent cached checks gate update-ref transactions at 2.27, hook run at 2.36, and hook run stdin at 2.40. A 2.36/2.39/2.40 matrix proves two real prepared/committed lifecycles plus one post-rewrite amendment, exact input delivery, replacement, and no unavailable --to-stdin invocation. A 2.27 regression proves atomic replacement while 2.26 remains conservative. Focused 67/521; integrated 1,878 passed, 8,381 assertions.

Pass 22 probe exposed a post-success ownership-evidence injection boundary: target branch movement is protected, but later loose update-ref HEAD dereferences whichever branch is current and reuses the automatic marker.

Pass 22 ownership synchronization boundary complete. The target branch marker remains authoritative, while worktree HEAD visibility is added in a second hook-suppressed prepared transaction that aborts if identity changed. A deterministic same-SHA sibling/manual-main race proves no forged sibling ownership and no later sibling replacement. Evidence-unavailable coverage was moved to the precise second-transaction seam and still proves a replacement can end its sequence. Focused 76/571; final integrated 1,880 passed, 8,398 assertions.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @andreas
created: 2026-07-29 09:25
---
Holistic findings B1, H1, M1, and M2: separate legacy new behavior from owned sequence starts; close the post-hook ref/reflog race; document the intentional branch-local resume behavior confirmed by the user; and replace English-subject parsing with structured rolling metadata.
---

author: @andreas
created: 2026-07-29 10:55
---
Holistic pass 2 finding M3: structured metadata exists, but document/decision/instruction updates still emit Add descriptors and can collapse distinct operations.
---

created: 2026-07-29 15:21
---
Holistic pass 6 M3: all instruction commits use identifier AI agent and one batch-wide action, so distinct files/actions collapse from the rolling operation list.
---

created: 2026-07-29 18:11
---
Pass 9 H1 reopens the explicit no-lost-selected-change contract: branch movement is revalidated, but changed selected tree entries are not compared before retry.
---

created: 2026-07-29 20:31
---
Pass 10 H1 reopens the no-lost-selected-change contract at the production wrapper boundary rather than direct commitFiles.
---

created: 2026-07-29 21:15
---
Pass 11 H1: owned/ref eligibility is revalidated before finalization, but final update-ref dereferences whatever symbolic HEAD names at execution time and can amend a different same-SHA branch.
---

created: 2026-07-29 22:23
---
Pass 12 H1/H2: detached finalization can replace a newly symbolic same-SHA HEAD, while named finalization rechecks only branch name under HEAD.lock and can miss reset, merge, tag, ownership, and index changes.
---

created: 2026-07-29 23:16
---
Pass 13 H1/M2: reference-transaction veto/context semantics are not preserved by synthetic/manual ref movement, and duplicate operations can survive initial or pre-existing rolling regions.
---

created: 2026-07-29 23:54
---
Pass 14 H1: prepared reference-transaction hook mutations are not revalidated before movement; a hook-created MERGE_HEAD advanced and marked a start-owned commit. The same gap affects detached and transient named replacement movement.
---

created: 2026-07-30 00:29
---
Pass 15 H1: a prepared hook veto is not authoritative through the production task wrapper because generic outer retries can start and commit a second reference transaction.
---

created: 2026-07-30 01:08
---
Pass 16 H1: the production wrapper propagation fix is insufficient when commitFiles first converts a veto plus hook-driven HEAD movement into an internal CAS retry.
---
<!-- COMMENTS:END -->
