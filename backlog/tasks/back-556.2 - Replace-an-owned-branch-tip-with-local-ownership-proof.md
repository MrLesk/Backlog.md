---
id: BACK-556.2
title: Replace an owned branch tip with local ownership proof
status: To Do
assignee: []
created_date: '2026-07-28 14:46'
updated_date: '2026-07-28 15:08'
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

This is the safety-critical core of BACK-556. It covers the replacement mechanics, the ownership evidence, and every boundary that must refuse a replacement. It deliberately excludes configuration and user-facing wiring, which arrive in BACK-556.3; until then nothing in the product replaces a commit.

Ownership must be exact-SHA based and repository-local, and must fail closed whenever evidence is missing, stale, malformed, or ambiguous. Ownership tracking must create no Git refs, notes, commits, trees, or blobs, so it contributes no ownership-only object reachable through `git rev-list --all --objects`; tests must distinguish intended branch-tip graph changes from the evidence itself. It must not introduce any network operation. The exact evidence format, the rule that matches a candidate `HEAD` against it, and the definition of stale evidence must be specified in one place and covered by tests rather than left to inference. If the selected evidence channel cannot record ownership, such as a branch with no usable reflog while automatic reflog creation is disabled, the tip remains not owned for as long as that condition lasts.

A replacement keeps the original parent set, author identity, and author date, but applies the effective signing configuration, format, and key available when the replacement runs, as a normal new automatic commit does. It does not inherit the old commit's signed or unsigned state. A required-signing or missing-key failure must leave `HEAD` unchanged.

The existing selected-path robustness stays intact: temporary-index isolation, owned-index reconciliation, retries, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates. Pre-commit and commit-message hooks use the isolated commit index so unrelated staging cannot leak into the commit or real index. Post-commit and post-rewrite run against the real index and worktree, and mutations they make there persist according to normal Git semantics. Replacement must additionally match the observable Git rewrite lifecycle, including `post-rewrite` with the old and new commit IDs and the `amend` argument.

See BACK-556 for the full ownership and safety contract, including the accepted limits of local-only publication detection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Git layer can replace the current branch tip with a commit that keeps the original parent set, author identity, and author date, refreshes committer metadata and commit ID, and uses the effective signing configuration, format, key, and failure behavior at replacement time rather than inheriting the old commit's signature state.
- [ ] #2 The replacement commit contains the tree of the commit it replaces plus only the newly selected paths.
- [ ] #3 The replacement commit retains the previous full message and appends the new operation message as an additional line, so no operation message is dropped.
- [ ] #4 Ownership is decided from exact repository-local provenance for the current HEAD SHA, never from author, changed-path, or subject heuristics.
- [ ] #5 The evidence format, the rule that matches a candidate HEAD against it, and the definition of stale evidence are specified in one place and covered by tests.
- [ ] #6 Cloned, legacy, manually created, manually amended, and reset commits, and any tip whose ownership evidence is missing, stale, malformed, or ambiguous, are reported as not owned.
- [ ] #7 Ownership tracking creates no Git refs, notes, commits, trees, or blobs and contributes no ownership-only object to git rev-list --all --objects; tests separately account for the intended automatic commit and branch-tip graph changes.
- [ ] #8 A tip is reported as not owned when HEAD is detached, is a merge commit, is reachable from a remote-tracking ref, or is shared by another local branch or tag, using local refs only and performing no network operation.
- [ ] #9 When the selected ownership channel cannot record evidence, including a current branch with no usable reflog while automatic reflog creation is disabled, the tip is reported as not owned for as long as evidence cannot be recorded.
- [ ] #10 After a failed expected-old-SHA update, ownership and eligibility are re-evaluated, and a concurrent non-Backlog commit is never overwritten.
- [ ] #11 Concurrent changes to the selected paths are either incorporated into the commit or reported as an error, and no selected change is lost silently.
- [ ] #12 The replacement path runs pre-commit, prepare-commit-msg, commit-msg, and post-commit consistently with Git amend semantics and invokes exactly one post-rewrite amend carrying the old and new commit IDs, while the new-commit path invokes no post-rewrite. Pre-commit and commit-message hook staging remains isolated; post-hook mutations against the real index and worktree persist.
- [ ] #13 bypassGitHooks and the legacy hook-runner path behave the same for replacements as for new commits.
- [ ] #14 Merge, rebase, cherry-pick, and revert in-progress guards fail closed without moving HEAD or consuming unrelated index entries.
- [ ] #15 Git-level tests cover repeated replacement sequences, root commits, manual and publication boundaries, pre/message-hook isolation and post-hook real-index mutations, signed-to-unsigned and unsigned-to-signed configuration transitions, required-signing failures, linked worktrees and branch switches, and concurrent branch movement.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
