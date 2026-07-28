---
id: BACK-556.3
title: Add the autoCommitMode setting and canonical CLI wiring
status: To Do
assignee: []
created_date: '2026-07-28 14:47'
updated_date: '2026-07-28 15:36'
labels:
  - cli
dependencies:
  - BACK-556.2
parent_task_id: BACK-556
priority: medium
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `autoCommitMode` setting and wire the commit-replacement behavior from BACK-556.2 into the shared core mutation path, so the feature becomes real for users through the canonical CLI workflow.

Persist the mode as `auto_commit_mode` in YAML and expose it as `autoCommitMode` in typed configuration, with values `new` and `amend-own`. A missing value behaves exactly as `new`; an invalid value is rejected rather than silently treated as `new`. `autoCommit` stays the independent enable/disable gate, and filesystem-only projects continue to force `autoCommit: false`.

The amend decision belongs in the shared core mutation path so CLI, TUI, browser, and MCP-triggered mutations cannot drift apart. A newly created commit begins an amendable sequence only when it lands on a named branch and valid ownership evidence for its exact SHA is successfully recorded. Detached operations and operations that cannot record evidence create unowned commits and continue using new on every repeated mutation while that condition persists.

Because rewriting a commit is consequential, this slice also delivers the human controls: the triggering surface must report when a mutation replaced a commit rather than creating one, and a per-invocation override must let a user seal the current rolling commit and start a fresh one without editing configuration. Documentation must cover rolling-commit boundaries, message accumulation, the local-only limits of publication detection, reflog recovery, and the safe `new` default.

`src/utils/config-watcher.ts` keeps an explicit recognized-config-key list that gates live reload; `auto_commit_mode` must be added there as well as to the config command surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Configuration accepts autoCommitMode with values new and amend-own, persists it as auto_commit_mode in YAML, and exposes it as autoCommitMode in typed configuration.
- [ ] #2 A missing autoCommitMode behaves exactly as new, and an invalid value is rejected with an error instead of falling back to new.
- [ ] #3 With autoCommit false, every mutation surface modifies files without creating or replacing commits under either mode.
- [ ] #4 In amend-own mode the first automatic mutation after a non-owned boundary creates one new commit; it becomes Backlog-owned and starts an amendable sequence only when it lands on a named branch and valid ownership evidence for its exact SHA is successfully recorded.
- [ ] #5 A later automatic mutation on an owned tip replaces it, so the commit count reachable from HEAD does not increase and the changes from both operations are present in the resulting tree.
- [ ] #6 A non-owned tip always produces a new commit. It starts a new amendable sequence only when the new tip is on a named branch and valid ownership evidence is successfully recorded; otherwise it remains unowned and the next mutation also creates a new commit.
- [ ] #7 The amend decision lives in the shared core mutation path, so CLI, TUI, browser, and MCP-triggered mutations share it, with cross-surface regression coverage.
- [ ] #8 Each triggering surface reports when a mutation replaced an existing commit instead of creating one, and identifies the commit it replaced.
- [ ] #9 A per-invocation override forces a new commit without changing configuration, ending the current rolling sequence.
- [ ] #10 autoCommitMode is readable and writable through backlog config get, set, and list with validation, appears in the available-keys help, and is recognized by live config reload.
- [ ] #11 Filesystem-only projects continue to force autoCommit false regardless of autoCommitMode.
- [ ] #12 Documentation explains rolling-commit boundaries, message accumulation, local-only publication detection including pushes that leave no remote-tracking ref, the risk of rewriting published history, reflog recovery, degradation to new when ownership evidence cannot be recorded, and the safe new default.
- [ ] #13 Tests cover both modes across task, draft, document, decision, milestone, and agent-instruction mutations, custom backlog roots, and repeated mutations with detached HEAD or unavailable ownership evidence.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
