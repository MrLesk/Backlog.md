---
id: BACK-556
title: Add amend-own mode for automatic Backlog commits
status: To Do
assignee: []
created_date: '2026-07-28 14:27'
labels: []
dependencies: []
references:
  - 'https://git-scm.com/docs/git-commit'
  - 'https://git-scm.com/docs/githooks'
  - 'https://git-scm.com/docs/git-commit-tree'
  - 'https://git-scm.com/docs/git-update-ref'
  - BACK-430
  - BACK-509
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

With `autoCommit: true`, every Backlog mutation currently creates a separate Git commit. Iterative task refinement can therefore produce many low-value commits even when the current `HEAD` was created solely by Backlog and no human-authored or published commit should be rewritten.

Add an opt-in `autoCommitMode` setting with values `new` and `amend-own`. The existing `autoCommit` boolean remains the enable/disable gate. Missing `autoCommitMode` must preserve current behavior by defaulting to `new`.

In `amend-own` mode, the first automatic mutation after a non-owned boundary creates a normal Backlog commit. A later automatic mutation replaces that commit only when Backlog can prove that the exact current branch tip was its own locally-created automatic commit and local Git state provides no evidence that the commit is shared or published. Otherwise Backlog creates a new automatic commit and starts a new amendable sequence. `autoCommit: false` continues to create no commits regardless of mode.

## Ownership and safety contract

“Owned” means that Backlog itself successfully advanced the current branch to the exact `HEAD` through its automatic-commit pipeline. It does not mean merely that the subject resembles a Backlog message or that all changed paths are under the configured backlog directory. Existing commits, cloned commits, manually-created lookalike commits, and legacy automatic commits without ownership evidence are not owned.

Ownership evidence must be repository-local, exact-SHA based, and fail closed when missing, stale, expired, or ambiguous. It must not add notes or side refs that change `git rev-list --all` results. The existing compare-and-swap `update-ref` protection must remain the final authority, and amend eligibility must be recomputed after every concurrent `HEAD` movement.

Do not amend when `HEAD` is detached, is a merge commit, is reachable from a remote-tracking ref, or is shared through another local branch or tag. These checks intentionally use local refs and must not introduce a network operation into automatic commits. Documentation must state that stale remote-tracking refs cannot prove remote publication state; rewriting published history remains unsafe.

A manual commit, manual amend, reset that updates the branch, loss of ownership metadata, clone, or another non-Backlog branch-tip update closes the amendable sequence. An in-progress merge, rebase, cherry-pick, or revert retains the current fail-closed behavior rather than being amended through.

## Commit contents and amendment semantics

Every commit eligible to be marked Backlog-owned must contain only paths selected for that Backlog operation. Unrelated staged, unstaged, and hook-staged paths must remain outside the commit and retain their original index/worktree state. This requires replacing production auto-commit paths that currently call broad `commitChanges()` after `stageBacklogDirectory()` with exact operation path sets through the selected-path commit pipeline. Known broad callers include promote/demote, bulk reorder/update, archive/complete, draft lifecycle, documents, decisions, and agent-instruction updates.

When amending, build the new tree from the current owned `HEAD` plus only the newly selected entries, but give the replacement commit the owned commit’s original parent set instead of making the owned commit its parent. Preserve the original author identity and author date, refresh normal committer metadata, preserve signing behavior, and retain the previous full commit message unless commit hooks deterministically modify it. The previous operation message must not be silently discarded.

The robust selected-path behavior added around `GitOperations.commitFiles()` remains required: temporary-index isolation, owned-index reconciliation, retries, Git-operation guards, signing, legacy and modern hook runners, and atomic expected-old-SHA branch updates. Amend behavior must additionally match Git’s observable rewrite lifecycle, including `post-rewrite` with the old/new commit IDs and `amend`, while preserving current `bypassGitHooks` semantics and running post hooks against the real index.

## Configuration and surfaces

Persist the mode as `auto_commit_mode` in YAML and expose it as `autoCommitMode` in typed configuration. Support validated `backlog config get/set/list`, the advanced CLI wizard, initialization/config summaries, browser initialization and Settings, and documentation. Invalid values must be rejected rather than silently treated as `new`. Filesystem-only projects continue to force `autoCommit: false`.

The behavior belongs in the shared core/Git mutation path so CLI, TUI, browser, and MCP-triggered mutations cannot drift.

## Research evidence

- `src/git/operations.ts` has no amend path. `commitChanges()` uses `git commit -m`; `commitFiles()` already constructs a selected tree with `commit-tree`, parents it to current `HEAD`, and advances `HEAD` with an expected-old-SHA `update-ref`.
- `getLastCommitMessage()` only reads a subject, and automatic subjects are inconsistent (`Create task`, task-ID-prefixed draft messages, `backlog:` lifecycle messages, and `Add AI agent instructions`), so subject matching cannot establish ownership.
- Multiple core paths still stage a directory or move and then use broad `commitChanges()`, which can consume unrelated entries already present in the real index.
- Official Git amend semantics preserve the current commit’s parents and author, replace the commit object, warn against rewriting published history, and invoke `post-commit` plus `post-rewrite`; `post-rewrite` receives an old/new object-ID mapping.
- A local experiment with Git 2.50 confirmed `git commit --amend -m` runs `prepare-commit-msg`, `post-commit`, then `post-rewrite amend`, and records `commit (amend)` in the branch reflog. The existing `update-ref -m` location can carry explicit local Backlog ownership evidence without adding a side ref.
- BACK-509 documents why auxiliary refs/notes can make `git rev-list --all --count` nondeterministic, so ownership tracking must avoid recreating that class of problem.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Configuration accepts `autoCommitMode: new | amend-own`, persists it as `auto_commit_mode`, defaults missing values to `new`, rejects invalid values, and leaves `autoCommit` as the independent enable/disable gate.
- [ ] #2 With `autoCommit: false`, all existing mutation surfaces continue to modify files without creating or amending commits regardless of `autoCommitMode`.
- [ ] #3 In `amend-own` mode, the first automatic mutation after a non-owned boundary creates one new Backlog-owned commit, and a subsequent mutation amends that exact commit so branch commit count does not increase and both operations are present in its tree.
- [ ] #4 An amended commit preserves the owned commit’s original parent set, author identity and author date, signing behavior, and previous full message; committer metadata and commit ID are refreshed as expected for an amend.
- [ ] #5 Backlog ownership is based on exact repository-local provenance rather than author, changed-path, or subject heuristics; cloned, legacy, manually-created, manually-amended, reset, or lookalike commits without current ownership evidence are never amended.
- [ ] #6 Ownership tracking creates no notes or side refs that alter `git rev-list --all`, and missing, stale, expired, malformed, or ambiguous ownership evidence fails closed by creating a new commit.
- [ ] #7 Backlog creates a new commit instead of amending when `HEAD` is detached, is a merge commit, is reachable from a remote-tracking ref, or is shared by another local branch or tag.
- [ ] #8 Every production automatic-commit path commits only the files selected for that operation; unrelated staged, unstaged, and hook-staged paths retain their prior index and worktree state for tasks, drafts, bulk updates/reorders, lifecycle moves, milestones, documents, decisions, and agent-instruction updates.
- [ ] #9 Concurrent `HEAD` or index changes cannot be overwritten: amend eligibility is re-evaluated after each failed expected-old-SHA update, a concurrent non-Backlog commit becomes a boundary, and concurrent selected changes are either safely incorporated or reported without data loss.
- [ ] #10 Pre-commit, prepare-commit-msg, commit-msg, post-commit, and post-rewrite behavior matches Git amend semantics, including one successful `post-rewrite amend` notification with the old/new IDs; `bypassGitHooks` and legacy hook-runner behavior remain compatible.
- [ ] #11 Merge, rebase, cherry-pick, and revert in-progress guards continue to fail closed without moving `HEAD`, corrupting operation metadata, or consuming unrelated index entries.
- [ ] #12 `autoCommitMode` is available consistently through config get/set/list, the advanced CLI wizard and summaries, browser initialization and Settings, shared typed/config serialization paths, and documented public configuration.
- [ ] #13 CLI, TUI, browser, and MCP-triggered mutations use the same shared amend-own decision and selected-path commit behavior, with representative cross-surface regression coverage.
- [ ] #14 Documentation explains rolling-commit boundaries, previous-message retention, local-only publication detection, the risk of rewriting published history, and the safe `new` default.
- [ ] #15 Focused Git/config/surface tests cover normal amend sequences, root commits, manual and publication boundaries, unrelated index state, hooks/signing, linked worktrees or branch switches, concurrent branch movement, custom backlog roots, and no-Git projects; typecheck, Biome, and the relevant test suites pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
