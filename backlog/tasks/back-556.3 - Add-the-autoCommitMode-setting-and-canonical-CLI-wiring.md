---
id: BACK-556.3
title: Add the autoCommitMode setting and canonical CLI wiring
status: In Progress
assignee:
  - '@andreas'
created_date: '2026-07-28 14:47'
updated_date: '2026-07-29 15:59'
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

Persist the mode as `auto_commit_mode` in YAML and expose it as `autoCommitMode` in typed configuration, with values `new` and `amend-own`. A missing value behaves exactly as `new`; an invalid value is rejected rather than silently treated as `new`. `autoCommit` stays the independent enable/disable gate, and filesystem-only projects continue to force `autoCommit: false`. The existing per-call `autoCommit` override keeps its current meaning of whether to commit and gains no role in choosing the mode, so the same configuration behaves the same way however a mutation was invoked.

The amend decision belongs in the shared core mutation path so CLI, TUI, browser, and MCP-triggered mutations cannot drift apart. A newly created commit begins an amendable sequence only when it lands on a named branch and valid ownership evidence for its exact SHA is successfully recorded. Detached operations and operations that cannot record evidence create unowned commits and continue using new on every repeated mutation while that condition persists.

Because rewriting a commit is consequential, this slice also delivers the human controls. The triggering surface must report when a mutation replaced a commit rather than creating one, naming the commit it replaced. `--no-amend` must let a user seal the current rolling commit and start a fresh one for a single invocation without editing configuration; it belongs on every command that can automatically commit, must appear in help, and is a no-op rather than an error under `autoCommitMode: new`.

Documentation must cover rolling-commit boundaries, how the message is rebuilt and duplicates collapsed, the factored subject, reflog recovery, and the safe `new` default. It must also state the accepted limits plainly: publication detection is local-only and cannot see a push that leaves no remote-tracking ref, a linked worktree parked on the tip with a detached `HEAD` is not detected, and `amend-own` is not supported alongside hooks that modify the commit message because a non-idempotent hook appends its output once per amend.

`src/utils/config-watcher.ts` keeps an explicit recognized-config-key list that gates live reload; `auto_commit_mode` must be added there as well as to the config command surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Configuration accepts autoCommitMode with values new and amend-own, persists it as auto_commit_mode in YAML, and exposes it as autoCommitMode in typed configuration.
- [x] #2 A missing autoCommitMode behaves exactly as new, and an invalid value is rejected with an error instead of falling back to new.
- [x] #3 With autoCommit false, every mutation surface modifies files without creating or replacing commits under either mode.
- [x] #4 An explicit per-invocation autoCommit override decides only whether the mutation commits; the configured autoCommitMode still decides how it commits, so the two settings stay orthogonal however the mutation was invoked.
- [x] #5 In amend-own mode the first automatic mutation after a non-owned boundary creates one new commit; it becomes Backlog-owned and starts an amendable sequence only when it lands on a named branch and valid ownership evidence for its exact SHA is successfully recorded.
- [x] #6 A later automatic mutation on an owned tip replaces it, so the commit count reachable from HEAD does not increase and the changes from both operations are present in the resulting tree.
- [x] #7 A non-owned tip always produces a new commit. It starts a new amendable sequence only when the new tip is on a named branch and valid ownership evidence is successfully recorded; otherwise it remains unowned and the next mutation also creates a new commit.
- [x] #8 The amend decision lives in the shared core mutation path, so CLI, TUI, browser, and MCP-triggered mutations share it, with cross-surface regression coverage.
- [x] #9 Each triggering surface reports when a mutation replaced an existing commit instead of creating one, and identifies the commit it replaced.
- [x] #10 The --no-amend option forces a new commit for a single invocation without changing configuration, is accepted by every command that can automatically commit, appears in that command help, and is a documented no-op rather than an error under autoCommitMode new.
- [x] #11 autoCommitMode is readable and writable through backlog config get, set, and list with validation, appears in the available-keys help, and is recognized by live config reload.
- [x] #12 Filesystem-only projects continue to force autoCommit false regardless of autoCommitMode.
- [x] #13 Documentation explains rolling-commit boundaries, message rebuilding and duplicate collapsing, the factored subject, reflog recovery, the risk of rewriting published history, degradation to new when ownership evidence cannot be recorded, and the safe new default. It also states the accepted limits: publication detection is local-only and cannot see a push that leaves no remote-tracking ref, a linked worktree parked on the tip with a detached HEAD is not detected, and amend-own is unsupported alongside hooks that modify the commit message because a non-idempotent hook appends its output once per amend.
- [x] #14 Tests cover both modes across task, draft, document, decision, milestone, and agent-instruction mutations, custom backlog roots, the --no-amend override, explicit per-call autoCommit overrides, and repeated mutations with detached HEAD or unavailable ownership evidence.
- [x] #15 The invocation force-new decision remains orthogonal to boolean enabled overrides and reaches every interactive CLI/TUI/browser mutation path that can automatically commit.
- [x] #16 All browser mutation clients, including archive and complete no-content responses, surface bounded replacement feedback through one centralized response path.
- [x] #17 The CLI help contract advertises --no-amend on every invocation surface whose interactive flow can trigger automatic mutations, with behavior coverage rather than help-text-only assertions.
- [x] #18 Every interactive command path that can reach a mutating unified view and MCP start advertises and honors --no-amend through one immutable invocation plan.
- [x] #19 CLI-created Core instances use one bounded result sink that both callbacks and TUI notice consumption drain without raw console output inside alternate-screen sessions.
- [x] #20 Malformed automatic-commit configuration is validated through one immutable preflight plan before any task, lifecycle, document, decision, milestone, or instruction mutation writes files; validation failure leaves bytes and Git state unchanged.
- [x] #21 Centralized browser feedback transport does not automatically replay non-idempotent mutations after ambiguous response loss or 5xx responses; response-loss coverage proves one user action produces at most one entity.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
15. Resolve an immutable invocation commit plan once and preserve force-new independently of enabled overrides across direct and interactive Core callers. Centralize bounded browser feedback handling for JSON and no-content responses and add end-to-end help/behavior tests.

16. Cover the actual interactive command graph and MCP startup with the invocation plan. Unify Core result recording/consumption so CLI TUI feedback uses the same bounded sink.

17. Route every mutating web API method through the centralized response/notice transport; connect direct agent-instruction commits to the shared bounded result recorder; expose one Core milestone-create mutation; and resolve/validate the invocation commit plan before filesystem writes.

18. Move draft promotion onto the centralized ApiClient mutation transport. Extend the resolved commit plan with an immutable Git configuration snapshot and pass it into GitOperations so concurrent plan resolution cannot alter filesystem-only, hook, signing, or safety behavior.

19. Route /api/init through BacklogServer.withAutoCommitFeedback and add an owned-tip browser initialization integration regression proving replacement feedback reaches the response header.

20. Separate mutation-preflight config validity from last-known-good watcher/display state so direct malformed on-disk changes reject every long-lived Core/browser/MCP mutation before writes. Split feedback-aware transport from retry policy so non-idempotent methods dispatch notices but are never automatically replayed after ambiguous failures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented typed/YAML autoCommitMode configuration with strict validation and safe new defaults. Routed configured amend-own decisions through Core for CLI, TUI, browser, MCP, milestones, and agent instructions while preserving boolean commit overrides. Added --no-amend to every automatic-commit CLI command, replacement notices for CLI/TUI/browser/MCP, comprehensive cross-entity tests, and rolling-commit safety/recovery documentation.

Holistic correction preserves force-new independently of boolean enable overrides and request feedback contexts; board/view/browser reuse the invocation Core; browser feedback is centralized and bounded; board, browser, and task view now advertise --no-amend.

Holistic pass 2 correction: all unified-view aliases plus MCP start advertise the immutable --no-amend invocation boundary; MCP server construction receives it. CLI-created Core instances now share one result array with TUI consumption, while a post-action flush reports direct-command notices only after interactive surfaces exit. Help, MCP force-new behavior, and CLI-shaped TUI sink regressions pass.

Pass 3 corrections: all web entity mutations use the centralized notice-aware transport; Core owns bounded agent-instruction result recording for direct CLI and re-init; browser/MCP milestone creation shares Core; and one immutable AsyncLocalStorage plan validates config before writes. Regressions cover every affected web method, CLI-shaped re-init, all milestone modes, invalid-config atomicity, and mid-write config changes.

Pass 4 corrections complete: draft promotion now uses ApiClient centralized notice dispatch. Resolved plans carry frozen Git-operation snapshots scoped by GitOperations AsyncLocalStorage, preventing concurrent filesystemOnly/hook/remote config replacement. Deterministic write-barrier regression passes. Expanded gate: 168 tests/1,232 assertions; integrated gate: TypeScript, 349-file Biome, 1,842 passed/4 skipped.

Pass 5 correction wraps /api/init in BacklogServer.withAutoCommitFeedback. An actual HTTP re-initialization regression proves owned agent-instruction replacement returns the bounded old/new SHA header. Expanded gate: 147 tests/1,176 assertions; integrated gate: TypeScript, 349-file Biome, 1,843 passed/4 skipped.

Pass 6 corrections separate direct mutation-preflight config reads from last-known-good watcher state and restrict centralized transport retries to safe GET/HEAD/OPTIONS requests. Long-lived Core/browser/MCP invalid-mode and non-idempotent response-loss regressions pass.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @andreas
created: 2026-07-29 09:25
---
Holistic findings B1, B2, and H2: new mode must remain behavior-preserving and unowned; --no-amend currently disappears through boolean and newly constructed Core paths; archive/complete browser responses currently drop amendment notices.
---

author: @andreas
created: 2026-07-29 10:55
---
Holistic pass 2 findings H2/M1: several unified-view aliases and MCP start lacked --no-amend propagation; createCliCore stored results outside the array consumed by TUI footers.
---

created: 2026-07-29 11:58
---
Holistic pass 3 found four gaps: raw-fetch document/decision/milestone clients suppress amendment headers; CLI init/agents pass an undefined result callback; browser milestone creation bypasses Core automatic commits; and invalid auto_commit_mode can be detected only after files have already changed.
---

created: 2026-07-29 13:20
---
Holistic pass 4 findings H1/M2: DraftsList still bypasses feedback for promotion, and the immutable plan snapshots intent but not GitOperations configuration, allowing concurrent plan resolution to replace filesystemOnly/hook/signing state during an in-flight mutation.
---

created: 2026-07-29 14:19
---
Holistic pass 5 H1: browser initialization can amend through agent-instruction writes, but /api/init bypasses the shared feedback wrapper and returns no X-Backlog-Auto-Commit header.
---

created: 2026-07-29 15:21
---
Holistic pass 6 H1/H2: long-lived config caching lets malformed mode bypass preflight, and centralized fetchWithRetry replays non-idempotent entity creates after a successful response is lost.
---
<!-- COMMENTS:END -->
