---
id: BACK-556.2
title: Replace an owned branch tip with local ownership proof
status: To Do
assignee: []
created_date: '2026-07-28 14:46'
updated_date: '2026-07-28 16:24'
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


## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Git layer can replace the current branch tip with a commit that keeps the original parent set, author identity, and author date, refreshes committer metadata and commit ID, and uses the effective signing configuration, format, key, and failure behavior at replacement time rather than inheriting the signature state of the commit it replaces.
- [ ] #2 The replacement commit contains the tree of the commit it replaces plus only the newly selected paths.
- [ ] #3 The replacement message is rebuilt rather than appended to: Backlog parses its operation lines out of the delimited region of the previous commit, merges in the new operation, collapses duplicates so each distinct operation appears once regardless of position, and regenerates the region and the subject from that list. Content outside the region is preserved verbatim and Backlog never re-renders on top of its own previous output.
- [ ] #4 A commit holding one operation keeps that operation subject unchanged. From the second distinct operation onward the subject is factored: operations sharing a verb and entity type list their IDs, the line elides past a 72 character budget with a plus N more suffix, and mixed verbs fall back to a count of distinct operations.
- [ ] #5 Ownership is decided from exact repository-local provenance for the current HEAD SHA, never from author, changed-path, or subject heuristics.
- [ ] #6 The evidence format, the rule that matches a candidate HEAD against it, and the definition of stale evidence are specified in one place and covered by tests.
- [ ] #7 Cloned, legacy, manually created, manually amended, and reset commits, and any tip whose ownership evidence is missing, stale, malformed, or ambiguous, are reported as not owned.
- [ ] #8 Ownership tracking creates no Git refs, notes, commits, trees, or blobs and contributes no ownership-only object to git rev-list --all --objects; tests separately account for the intended automatic commit and branch-tip graph changes.
- [ ] #9 A tip is reported as not owned when HEAD is detached, is a merge commit, is reachable from a remote-tracking ref, or is reachable from any local branch other than the current branch or any tag, including annotated tags and both refs that point directly to the candidate and refs that point to a descendant, using local refs only and performing no network operation.
- [ ] #10 A new commit is reported as owned only when it lands on a named branch and valid evidence for its exact SHA is successfully recorded. Commits created with detached HEAD or while the selected ownership channel cannot record evidence, including a branch with no usable reflog while automatic reflog creation is disabled, remain unowned, and repeated operations in either state cannot enter the replacement path.
- [ ] #11 A replacement commit records valid ownership evidence for its own new SHA on the same terms as a newly created commit, so an amendable sequence survives repeated replacements. If that recording does not succeed, the sequence ends at that commit and the next operation creates a new commit.
- [ ] #12 After a failed expected-old-SHA update, ownership and eligibility are re-evaluated, and a concurrent non-Backlog commit is never overwritten.
- [ ] #13 Concurrent changes to the selected paths are either incorporated into the commit or reported as an error, and no selected change is lost silently.
- [ ] #14 The replacement path runs pre-commit, prepare-commit-msg with message as its source argument, commit-msg, and post-commit consistently with Git amend semantics, and invokes exactly one post-rewrite amend carrying the old and new commit IDs, while the new-commit path invokes no post-rewrite. Pre-commit and commit-message hook staging remains isolated; post-hook mutations against the real index and worktree persist.
- [ ] #15 post-commit and post-rewrite are notifications: a failing post hook does not fail the operation or move HEAD.
- [ ] #16 bypassGitHooks and the legacy hook-runner path behave the same for replacements as for new commits.
- [ ] #17 Merge, rebase, cherry-pick, and revert in-progress guards fail closed without moving HEAD or consuming unrelated index entries.
- [ ] #18 Git-level tests cover repeated replacement sequences with evidence re-recorded at each step; subject shapes for single, factored, elided, and mixed-verb cases; duplicate collapsing; region parsing when a hook has appended content outside the region; repeated detached and evidence-unavailable new commits; root commits; manual and publication boundaries; local branches, lightweight tags, and annotated tags pointing directly to candidates and to descendants; pre and message hook isolation, post-hook real-index mutations, and failing post hooks; signed-to-unsigned and unsigned-to-signed configuration transitions; required-signing failures; linked worktrees and branch switches; and concurrent branch movement.
<!-- AC:END -->
