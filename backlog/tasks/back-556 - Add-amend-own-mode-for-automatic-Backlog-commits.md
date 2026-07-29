---
id: BACK-556
title: Add amend-own mode for automatic Backlog commits
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:27'
updated_date: '2026-07-29 14:19'
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

In `amend-own` mode, the first automatic mutation after a non-owned boundary creates a normal Backlog commit. A later automatic mutation replaces that commit only when Backlog can prove that the exact current branch tip was its own locally-created automatic commit and local Git state provides no evidence that the commit is shared or published. Otherwise Backlog creates a new automatic commit. That commit starts an amendable sequence only when it lands on a named branch and Backlog successfully records valid ownership evidence for its exact SHA. A commit created while `HEAD` is detached or ownership evidence is unavailable remains unowned, so every later mutation while that condition persists creates another new commit. `autoCommit: false` continues to create no commits regardless of mode.

## Ownership and safety contract

"Owned" means that Backlog itself successfully advanced the current branch to the exact `HEAD` through its automatic-commit pipeline. It does not mean merely that the subject resembles a Backlog message or that all changed paths are under the configured backlog directory. Existing commits, cloned commits, manually-created lookalike commits, and legacy automatic commits without ownership evidence are not owned.

Ownership evidence must be repository-local, exact-SHA based, and fail closed when missing, stale, malformed, or ambiguous. It must not create refs, notes, commits, trees, or blobs, and therefore must contribute no ownership-only object reachable through `git rev-list --all --objects`. The implementation must define in one place, and cover with tests, the exact evidence format, the rule that matches a candidate `HEAD` against it, and what makes evidence stale. Tests must distinguish the intended branch-tip commit and tree changes from the evidence itself and verify that the evidence adds no reachable object. The existing compare-and-swap `update-ref` protection remains the final authority, and amend eligibility must be recomputed after every concurrent `HEAD` movement.

A replacement commit is owned on exactly the same terms as a newly created one: the replacement must itself record valid ownership evidence for its own new SHA. If that recording does not succeed, the amendable sequence ends at that commit and the next mutation creates a new commit. Recording ownership only at sequence start would collapse `amend-own` into amend-once.

Do not amend when `HEAD` is detached, is a merge commit, is reachable from a remote-tracking ref, or is reachable from any local branch other than the current branch or from any tag, including annotated tags. Local sharing includes a ref that points directly to the candidate tip and a ref that points to a descendant retaining the candidate in its history. These checks intentionally use local refs and must not introduce a network operation into automatic commits.

Three limits of local-only detection are accepted rather than solved, and must be documented:

- Stale remote-tracking refs cannot prove current remote state.
- `git push <url> HEAD:branch`, or a push to a remote with no fetch refspec, publishes without updating any remote-tracking ref.
- A linked worktree parked at the candidate tip with a detached `HEAD` is not a branch or tag, so the reachability checks above do not see it. Rewriting the tip leaves that worktree pointing at an orphaned commit.

Backlog can therefore amend a commit that is already published or still checked out elsewhere by those routes. Rewriting published history remains unsafe.

A manual commit, manual amend, reset that updates the branch, loss of ownership metadata, clone, or another non-Backlog branch-tip update closes the amendable sequence. An in-progress merge, rebase, cherry-pick, or revert retains the current fail-closed behavior rather than being amended through.

Where the selected evidence channel cannot record ownership — for example when automatic reflog creation is disabled and the current branch has no usable reflog — `amend-own` degrades to `new` for as long as ownership cannot be recorded. Commits created during that period remain unowned, and repeated mutations continue creating new commits. That conservative fallback is required and must be documented rather than becoming a silent surprise.

## Commit contents

Every commit eligible to be marked Backlog-owned must contain only paths selected for that Backlog operation. Pre-existing unrelated staged and unstaged paths, and unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, must remain outside the commit and retain their prior real-index and worktree state. Post-commit and post-rewrite hooks run against the real index and worktree; mutations they make there persist according to normal Git semantics. Known broad callers that currently commit more than the operation paths include promote/demote, bulk reorder/update, archive/complete, draft lifecycle, documents, decisions, and agent-instruction updates.

## Commit message of a rolling commit

Backlog owns two parts of the message: the subject line, and one delimited region in the body that lists the operations the commit contains. Everything outside that region is preserved verbatim.

On each replacement, Backlog parses its operation lines back out of the previous commit region, merges in the new operation, and regenerates both the subject and the region from that list. It never re-renders on top of its own previous output, so repeated replacement cannot compound formatting.

Duplicate operations collapse: an operation that recurs appears once, regardless of position. Line order therefore records which distinct operations a commit contains, not the sequence in which they happened.

The subject follows the operation list. A commit holding a single operation keeps that operation's own subject unchanged. From the second distinct operation onward the subject is factored:

- When the operations share a verb and entity type, factor them and list the IDs, for example `backlog: Update tasks BACK-123.1, BACK-123.2`.
- Elide past a 72-character budget, for example `backlog: Update tasks BACK-123.1, BACK-123.2 +5 more`.
- When verbs differ, fall back to a count, for example `backlog: 7 changes`. The count is of distinct operations, not files.

`amend-own` is not supported alongside hooks that modify the commit message, such as trailer or ticket-reference generators. Backlog does not detect or prevent that combination. The documentation must state plainly that a non-idempotent message hook appends its output once per amend, so its additions accumulate across a rolling sequence.

## Amendment semantics

The amended commit keeps the owned commit's original parent set, author identity, and author date. It uses the effective signing configuration and key available when the replacement operation runs, exactly as a new automatic commit does; it does not inherit the replaced commit's signed or unsigned state, and a signing failure must leave `HEAD` unchanged. Committer metadata and the commit ID refresh as they would for a normal amend.

Existing robustness around selected-path commits remains required: temporary-index isolation, owned-index reconciliation, retries, Git-operation guards, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates. Amend behavior must additionally match the observable Git rewrite lifecycle, including `post-rewrite` with the old and new commit IDs and the `amend` argument, while preserving current `bypassGitHooks` semantics and running post hooks against the real index. As in Git, `post-commit` and `post-rewrite` are notifications: their failure must not fail the mutation or move `HEAD`.

## Human control and visibility

Rewriting a commit is consequential, so a human must be able to see it, stop it, and undo it:

- Every mutation that amends instead of creating must say so on the surface that triggered it, naming the commit it replaced.
- `--no-amend` forces a new commit for a single invocation, so a user can seal the current rolling commit and start a fresh one without editing configuration. It must be available on every command that can automatically commit, appear in help, and be a no-op rather than an error under `autoCommitMode: new`.
- Documentation must explain recovery through the branch reflog when an amend was not wanted.

Without these, an `amend-own` sequence has no natural end: a long working session collapses into one ever-growing commit until an unrelated manual commit or push happens to break it.

An explicit per-invocation `autoCommit` override decides only whether the mutation commits at all. The configured `autoCommitMode` still decides how it commits, so the two settings stay orthogonal regardless of how a mutation was invoked.

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
- `commitFiles()` already treats `post-commit` as a notification and ignores its failure, which is the behavior the replacement path must extend to `post-rewrite`.
- `getLastCommitMessage()` only reads a subject, and automatic subjects are inconsistent (`Create task`, task-ID-prefixed draft messages, `backlog:` lifecycle messages, `Update N tasks`, and `Add AI agent instructions`), so subject matching cannot establish ownership.
- Multiple core paths still stage a directory or a move and then use broad `commitChanges()`, which can consume unrelated entries already present in the real index.
- `Core.shouldAutoCommit()` already accepts a per-call boolean override, which is the existing seam for keeping the override orthogonal to the mode.
- `src/utils/config-watcher.ts` keeps an explicit recognized-config-key list that gates live reload; `auto_commit_mode` must be added there as well as to the CLI and browser surfaces.
- Official Git amend semantics preserve the current commit parents and author, replace the commit object, use the current signing configuration, warn against rewriting published history, and invoke `post-commit` plus `post-rewrite`; `post-rewrite` receives an old and new object-ID mapping.
- A local experiment with Git 2.50 confirmed `git commit --amend -m` runs `prepare-commit-msg`, `post-commit`, then `post-rewrite amend`, and records `commit (amend)` in the branch reflog. The existing `update-ref -m` location is one candidate for local ownership evidence that adds no side ref; the worker should confirm it during planning rather than treating it as decided.
- BACK-509 documents why auxiliary refs and notes can make `git rev-list --all --count` nondeterministic, so ownership tracking must avoid graph-visible metadata.
- BACK-430 is referenced for its follow-up work rather than its title: the robust selected-path `commitFiles()` pipeline landed under it in commit `1b6de48`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With autoCommit true and autoCommitMode amend-own, a run of consecutive Backlog mutations on an owned branch tip produces exactly one commit that contains every change, lists every distinct operation once in its message region, and carries a subject that reflects the operations it holds rather than only the first one.
- [x] #2 Every documented non-owned boundary makes Backlog create a new commit instead of amending: manual commit, manual amend, reset, detached HEAD, merge commit, reachability from a remote-tracking ref, reachability from any other local branch or tag including direct and descendant refs, and missing, stale, malformed, or ambiguous ownership evidence. A commit created detached or while evidence cannot be recorded remains unowned, so repeated mutations in either persistent state continue creating new commits.
- [x] #3 autoCommitMode defaults to new when absent, rejects invalid values with an error, and has no effect while autoCommit is false or the project is filesystem-only. An explicit per-invocation autoCommit override decides only whether to commit and never changes the mode.
- [x] #4 No automatic Backlog commit, in either mode, contains paths outside those selected for the operation. Pre-existing unrelated index and worktree state plus pre-commit and commit-message hook staging through the isolated index are preserved, while mutations made by post hooks against the real index and worktree persist according to normal Git semantics.
- [ ] #5 A human can see when an amend happened, force a new commit for a single invocation with --no-amend on any command that can automatically commit, and follow documented reflog recovery for an unwanted amend.
- [x] #6 The upstream cross-platform test/build/Nix workflow executes successfully for the final implementation SHA, or the task records that first-time-contributor workflow approval is externally blocked on an upstream maintainer before merge.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Specification plan. Three review passes refined this task before implementation; this records the decisions that resolve them, so the worker does not have to re-litigate them. Implementation plans belong on the subtasks, recorded after each is picked up.

Message design, decided after review found the accumulation rule underspecified:

1. Message hooks. `amend-own` is unsupported alongside hooks that modify the commit message. Not detected or prevented; documented instead. A non-idempotent hook appends its output once per amend.
2. Subject. Factored from the operation list. Shared verb and entity list the IDs; elide past a 72 character budget with a plus N more suffix; mixed verbs fall back to a count of distinct operations. A single-operation commit keeps its own subject.
3. Operation lines live in a delimited region of the commit message, not in a side file. The region travels with the commit, cannot desync, and adds no state outside objects that already exist.
4. Duplicate operations collapse to one line regardless of position. Line order records which distinct operations a commit contains, not when they happened.

Scope and safety, decided in the same pass:

5. A linked worktree parked on the candidate tip with a detached HEAD is an accepted, documented limit rather than a check, alongside the two publication limits.
6. An explicit per-call autoCommit override decides only whether to commit. The configured mode still decides how.
7. The force-a-new-commit control is named --no-amend.

Three wording gaps closed at the same time: a replacement commit must record ownership evidence for its own new SHA or the sequence ends there; post-commit and post-rewrite are notifications whose failure must not fail the operation; prepare-commit-msg receives message as its source argument on the replacement path.

Delivery order is 556.1, then 556.2, then 556.3, then 556.4. 556.1 is a correctness fix that ships on its own under the default new mode. 556.2 and 556.3 are separable to review but must land together to be honest, because 556.2 alone changes nothing a user can see.

Holistic correction pass: resolve the documented Git intent/state, invocation-control, cross-surface feedback, structured-message, lifecycle, test-reliability, and PR-scope findings; then repeat fresh full-scope gpt-5.6-sol xhigh reviews until exact ALL GOOD.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered through BACK-556.1-.4: exact selected-path automatic commits, reflog-proven owned-tip replacement with fail-closed safety checks and Git-compatible hooks, typed/configurable new and amend-own modes with --no-amend, and consistent CLI/TUI/MCP/browser feedback and settings. Added rolling message reconstruction, documentation, and broad cross-entity, boundary, hook, custom-root, configuration, and UI/API tests.

Holistic correction pass implemented findings B1/B2/H1/H2/M1/M2/M3 plus shared mode validation. First integrated full gate passed: TypeScript, Biome (348 files), and 1,830 tests passed with 4 skipped across 205 files.

Second full-gate run after review-history cleanup also passed: TypeScript, Biome (348 files), and 1,830 tests passed with 4 skipped across 205 files. The two consecutive full suites completed in 460.13s and 447.68s without failures.

Fresh holistic gpt-5.6-sol xhigh pass 2 at 10ea4b2: REQUEST_CHANGES, 2 high/3 medium/1 low. Reviewer independently confirmed the initial B1/H1/H2/M1/M3/L1 corrections and both full gates.

Holistic pass 2 findings H1/H2/M1/M2/M3 are implemented. Focused gate: 144 tests, 673 assertions. Integrated gate: TypeScript and full Biome clean; 1,835 tests passed with 4 skipped across 205 files. Draft PR evidence will be refreshed after this stable fix commit.

A second consecutive final-state integrated gate passed: TypeScript and full Biome clean; 1,835 tests passed with 4 skipped across 205 files. The two full suites completed without retries or failures.

All parent acceptance criteria are now supported by the implemented task-family evidence and two consecutive final-state gates. Status remains In Progress until the mandated fresh holistic reviewer returns exact ALL GOOD.

All four holistic pass 3 findings are implemented. Focused verification passed 171 tests with 729 assertions. The integrated rerun passed TypeScript, Biome over 348 files, and 1,841 tests with 4 skips/0 failures across 205 files. The prior run's sole 1.5-second loaded Git-request abort was stabilized with a mutation-specific 10-second bound and passed on retry.

Pass 4 code findings fixed and fully verified: 168 focused tests/1,232 assertions and an integrated 1,842 passed/4 skipped/0 failed across 205 files, with TypeScript and 349-file Biome clean. Upstream workflow run 30453460692 remains action_required with zero jobs; contributor apetersson attempted approval and GitHub returned HTTP 403 Must have admin rights to Repository, recording the explicit external maintainer gate.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @andreas
created: 2026-07-29 10:19
---
Fresh holistic review at 459e44ba requested changes with nine findings: default new commits were incorrectly marked as owned; --no-amend was lost in interactive/boolean paths; hook-created refs could stale eligibility; archive/complete browser notices were dropped; branch-local resume behavior was documented incorrectly; production draft messages did not factor; lifecycle logic duplicated and masked ambiguity; the full suite was load-sensitive/expensive; and model-specific review transcripts added PR noise. Existing criteria affected by those findings are reopened.
---

author: @andreas
created: 2026-07-29 10:19
---
PR hygiene disposition for L1: remove the four model-specific CReview transcript commits from branch history before the next holistic review while retaining canonical task plans, notes, criteria, and the new reviewer findings documented through Backlog CLI.
---

author: @andreas
created: 2026-07-29 10:55
---
Holistic pass 2 requested changes with six findings: draft rename path completeness, all interactive/MCP --no-amend entrypoints, CLI/TUI result-sink consistency, lifecycle validation propagation, accurate add/update descriptors, and stale draft-PR checklist/test evidence. Findings are recorded on BACK-556.1-.3; PR text will be refreshed after fixes and final task verification.
---

created: 2026-07-29 11:58
---
Fresh holistic gpt-5.6-sol xhigh pass 3 at 4d14a84 requested changes with four findings: browser entity feedback gaps, missing CLI agent-instruction feedback, browser milestone creation bypassing Core auto-commit, and post-write invalid-mode validation. The affected criteria and gates are reopened before implementation; report: /tmp/backlog-821-holistic-review-pass-3.md.
---

created: 2026-07-29 13:20
---
Fresh holistic gpt-5.6-sol xhigh pass 4 at 023d108 requested changes: browser draft promotion feedback, immutable Git-config state under concurrent mutation plans, and upstream workflow run 30453460692 awaiting maintainer approval with zero jobs. Code findings are reopened; CI approval is tracked as an external pre-merge gate. Report: /tmp/backlog-821-holistic-review-pass-4.md.
---

created: 2026-07-29 14:19
---
Fresh holistic gpt-5.6-sol xhigh pass 5 at 7b16a30 returned one High finding: /api/init can amend agent instructions without the shared automatic-commit feedback header. Reviewer focused gate passed 146 tests/1,172 assertions and preserved exact clean HEAD. Report: /tmp/backlog-821-holistic-review-pass-5.md.
---
<!-- COMMENTS:END -->
