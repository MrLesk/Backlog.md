---
id: BACK-556
title: Add amend-own mode for automatic Backlog commits
status: To Do
assignee: []
created_date: '2026-07-28 14:27'
updated_date: '2026-07-28 14:47'
labels:
  - enhancement
  - git
dependencies: []
references:
  - 'https://git-scm.com/docs/git-commit'
  - 'https://git-scm.com/docs/githooks'
  - 'https://git-scm.com/docs/git-commit-tree'
  - 'https://git-scm.com/docs/git-update-ref'
  - BACK-430
  - BACK-509
priority: medium
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

With `autoCommit: true`, every Backlog mutation currently creates a separate Git commit. Iterative task refinement can therefore produce many low-value commits even when the current `HEAD` was created solely by Backlog and no human-authored or published commit should be rewritten.

Add an opt-in `autoCommitMode` setting with values `new` and `amend-own`. The existing `autoCommit` boolean remains the enable/disable gate. Missing `autoCommitMode` must preserve current behavior by defaulting to `new`.

In `amend-own` mode, the first automatic mutation after a non-owned boundary creates a normal Backlog commit. A later automatic mutation replaces that commit only when Backlog can prove that the exact current branch tip was its own locally-created automatic commit and local Git state provides no evidence that the commit is shared or published. Otherwise Backlog creates a new automatic commit and starts a new amendable sequence. `autoCommit: false` continues to create no commits regardless of mode.

## Ownership and safety contract

"Owned" means that Backlog itself successfully advanced the current branch to the exact `HEAD` through its automatic-commit pipeline. It does not mean merely that the subject resembles a Backlog message or that all changed paths are under the configured backlog directory. Existing commits, cloned commits, manually-created lookalike commits, and legacy automatic commits without ownership evidence are not owned.

Ownership evidence must be repository-local, exact-SHA based, and fail closed when missing, stale, malformed, or ambiguous. It must not add notes or side refs that change `git rev-list --all` results. The implementation must define in one place, and cover with tests, the exact evidence format, the rule that matches a candidate `HEAD` against it, and what makes evidence stale; these cannot be left to inference. The existing compare-and-swap `update-ref` protection remains the final authority, and amend eligibility must be recomputed after every concurrent `HEAD` movement.

Do not amend when `HEAD` is detached, is a merge commit, is reachable from a remote-tracking ref, or is shared through another local branch or tag. These checks intentionally use local refs and must not introduce a network operation into automatic commits.

Two limits of local-only detection are accepted rather than solved, and must be documented: stale remote-tracking refs cannot prove current remote state, and `git push <url> HEAD:branch` — or a push to a remote with no fetch refspec — publishes without updating any remote-tracking ref. Backlog can therefore amend a commit already published by those routes. Rewriting published history remains unsafe.

A manual commit, manual amend, reset that updates the branch, loss of ownership metadata, clone, or another non-Backlog branch-tip update closes the amendable sequence. An in-progress merge, rebase, cherry-pick, or revert retains the current fail-closed behavior rather than being amended through.

Where ownership evidence cannot be recorded at all — for example a repository with `core.logAllRefUpdates` disabled — `amend-own` degrades permanently to `new`. That is a safe outcome, but it must be stated and documented behavior rather than a silent surprise.

## Commit contents and message

Every commit eligible to be marked Backlog-owned must contain only paths selected for that Backlog operation. Unrelated staged, unstaged, and hook-staged paths must remain outside the commit and retain their original index and worktree state. Known broad callers that currently commit more than the operation paths include promote/demote, bulk reorder/update, archive/complete, draft lifecycle, documents, decisions, and agent-instruction updates.

An amended commit accumulates messages: the previous full message is retained and the new operation message is appended as an additional line, so the commit record names every operation it contains. Neither message may be silently discarded. Commit hooks may still modify the resulting message. This resolves an ambiguity in the original specification, which could also have been read as freezing the message at the first operation; a frozen message would leave a rolling commit labeled `Create task BACK-1` while containing archives, reorders, and edits, which contradicts the project goal of reviewable evidence.

The amended commit keeps the owned commit original parent set, author identity, author date, and signing behavior; committer metadata and commit ID refresh as they would for a normal amend.

Existing robustness around selected-path commits remains required: temporary-index isolation, owned-index reconciliation, retries, Git-operation guards, signing, legacy and modern hook runners, and atomic expected-old-SHA branch updates. Amend behavior must additionally match the observable Git rewrite lifecycle, including `post-rewrite` with the old and new commit IDs and the `amend` argument, while preserving current `bypassGitHooks` semantics and running post hooks against the real index.

## Human control and visibility

Rewriting a commit is consequential, so a human must be able to see it, stop it, and undo it:

- Every mutation that amends instead of creating must say so on the surface that triggered it, naming the commit it replaced.
- A per-invocation way to force a new commit must exist, so a user can seal the current rolling commit and start a fresh one without editing configuration.
- Documentation must explain recovery through the branch reflog when an amend was not wanted.

Without these, an `amend-own` sequence has no natural end: a long working session collapses into one ever-growing commit until an unrelated manual commit or push happens to break it.

## Configuration and surfaces

Persist the mode as `auto_commit_mode` in YAML and expose it as `autoCommitMode` in typed configuration. Support validated `backlog config get/set/list`, the advanced CLI wizard, initialization and config summaries, live config reload, browser initialization and Settings, and documentation. Invalid values must be rejected rather than silently treated as `new`. Filesystem-only projects continue to force `autoCommit: false`.

The behavior belongs in the shared core/Git mutation path so CLI, TUI, browser, and MCP-triggered mutations cannot drift.

## Delivery

This task is delivered through subtasks, because the selected-path correctness fix is valuable on its own under the default `new` mode and the remaining work is too large for one reviewable change:

- BACK-556.1 — commit only the paths each automatic operation selects.
- BACK-556.2 — Git-layer commit replacement with local ownership evidence.
- BACK-556.3 — the `autoCommitMode` setting and canonical CLI wiring that turns the behavior on.
- BACK-556.4 — human-facing configuration surfaces.

## Research evidence

- `src/git/operations.ts` has no amend path. `commitChanges()` uses `git commit -m`; `commitFiles()` already constructs a selected tree with `commit-tree`, parents it to current `HEAD`, and advances `HEAD` with an expected-old-SHA `update-ref`.
- `getLastCommitMessage()` only reads a subject, and automatic subjects are inconsistent (`Create task`, task-ID-prefixed draft messages, `backlog:` lifecycle messages, `Update N tasks`, and `Add AI agent instructions`), so subject matching cannot establish ownership.
- Multiple core paths still stage a directory or a move and then use broad `commitChanges()`, which can consume unrelated entries already present in the real index.
- `src/utils/config-watcher.ts` keeps an explicit recognized-config-key list that gates live reload; `auto_commit_mode` must be added there as well as to the CLI and browser surfaces.
- Official Git amend semantics preserve the current commit parents and author, replace the commit object, warn against rewriting published history, and invoke `post-commit` plus `post-rewrite`; `post-rewrite` receives an old and new object-ID mapping.
- A local experiment with Git 2.50 confirmed `git commit --amend -m` runs `prepare-commit-msg`, `post-commit`, then `post-rewrite amend`, and records `commit (amend)` in the branch reflog. The existing `update-ref -m` location is one candidate for local ownership evidence that adds no side ref; the worker should confirm it during planning rather than treating it as decided.
- BACK-509 documents why auxiliary refs and notes can make `git rev-list --all --count` nondeterministic, so ownership tracking must avoid recreating that class of problem.
- BACK-430 is referenced for its follow-up work rather than its title: the robust selected-path `commitFiles()` pipeline landed under it in commit `1b6de48`.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With autoCommit true and autoCommitMode amend-own, a run of consecutive Backlog mutations on an owned branch tip produces exactly one commit that contains every change and names every operation in its message.
- [ ] #2 Every documented non-owned boundary makes Backlog create a new commit instead of amending: manual commit, manual amend, reset, detached HEAD, merge commit, reachability from a remote-tracking ref, sharing by another local branch or tag, and missing, stale, malformed, or ambiguous ownership evidence.
- [ ] #3 autoCommitMode defaults to new when absent, rejects invalid values with an error, and has no effect while autoCommit is false or the project is filesystem-only.
- [ ] #4 No automatic Backlog commit, in either mode, contains files outside the paths selected for that operation, and unrelated staged, unstaged, and hook-staged paths keep their prior index and worktree state.
- [ ] #5 A human can see when an amend happened, force a new commit for a single invocation without changing configuration, and follow documented reflog recovery for an unwanted amend.
<!-- AC:END -->
