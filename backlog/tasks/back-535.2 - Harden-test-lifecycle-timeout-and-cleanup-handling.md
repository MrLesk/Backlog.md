---
id: BACK-535.2
title: 'Harden test lifecycle, timeout, and cleanup handling'
status: In Progress
assignee:
  - '@test-hygiene-slice-b'
created_date: '2026-07-11 09:20'
updated_date: '2026-07-11 10:51'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: high
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make test lifecycle failures deterministic and visible without changing production behavior. Replace shared-path and uncancelled-timeout patterns, classify every broad catch/swallow site, update the Testing Style Guide away from ignored cleanup failures, and limit this PR to proven shared helpers and high-risk sites. Remaining independent mechanical conversions must be recorded as later BACK-535 child tasks rather than expanded here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All broad catch/swallow sites from the BACK-535 baseline are classified as expected-error assertion, redundant setup cleanup, swallowed teardown/resource cleanup, or justified best-effort handling, with file-level evidence recorded
- [x] #2 config-hang-repro uses an isolated unique directory and a timeout that is cancelled or cleared on every settlement path
- [x] #3 Shared timeout helpers used by changed tests cannot leave rejecting promises, timers, subscriptions, or child processes alive after settlement
- [x] #4 High-risk changed teardown paths surface cleanup failures while preserving primary test failure evidence; cleanup errors are not silently ignored
- [x] #5 The Testing Style Guide requires isolated temp paths, observable synchronization, cancellable timers/subscriptions/processes, global-state restoration, and fail-visible cleanup
- [x] #6 Remaining mechanical cleanup batches are captured as scoped BACK-535 child follow-ups with named files and no duplicate scope
- [x] #7 No production behavior changes
- [ ] #8 Focused repeated stress, full tests, typecheck, Biome, build, and before/after runtime measurements pass, followed by sequential specification and quality approval
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory every block catch, empty catch, and Promise .catch site; assign cleanup sites to exact follow-ups and document justified exclusions.
2. Introduce the smallest self-cleaning timeout helper, prove timer cancellation on every settlement path, and repair config-hang-repro isolation.
3. Cover the undocumented legacy lock escape hatch as a deterministic internal withCreateLock test with finally release and drained exact outcomes; retain the adjacent persisted unique-ID contract test.
4. Update the Testing Style Guide and create non-overlapping, site-level child follow-ups for filesystem and resource cleanup.
5. Run repeated focused stress, full/static/build checks on current main, record runtime evidence, and complete sequential reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Catch/swallow audit reconciled the BACK-535 baseline of 89 sites. Slice A removed two cli-dependency sites: one redundant setup pre-clean and one swallowed teardown. The remaining exact scan found 87: 70 swallowed teardown/resource cleanups, 13 redundant setup pre-cleans, 3 justified best-effort probes, and 1 expected-error assertion. Therefore the original baseline classifies as 71 teardown/resource, 14 setup pre-clean, 3 justified, and 1 expected-error assertion.

Redundant setup files: acceptance-criteria-structured, cleanup, cli-dependency (removed by Slice A), cli-milestone-filter, cli-parent-filter, cli-plain-create-edit, cli-plain-output, cli-refs-docs, cli-task-milestone, cli-zero-padded-ids, cli, desc-alias, description-newlines, and draft-create-consistency. Justified best-effort probes: cli-init-no-git pathExists returns false, mcp-workspace-root missing task directory returns an empty list, and tui-interactive-editor-handoff optionally falls back when /dev/tty cannot be opened. Expected-error assertion: cli checks a missing required directory by failing the assertion inside the stat catch.

Swallowed teardown/resource files: acceptance-criteria-structured, acceptance-criteria, agent-instructions, append-implementation-notes, auto-commit, board-command, board-loading, build, cleanup, cli-agents, cli-auto-plain-non-tty, cli-board-integration, cli-commit-behaviour, cli-dependency (removed by Slice A), cli-final-summary, cli-incrementing-ids, cli-init-no-git, cli-milestone-filter, cli-parent-filter, cli-plain-create-edit, cli-plain-output, cli-refs-docs, cli-task-milestone, cli-task-type, cli-task-wizard, cli-zero-padded-ids, cli, comments, config-commands, content-store, core, definition-of-done-cli, definition-of-done, desc-alias, description-newlines, documentation, draft-create-consistency, editor, enhanced-init, filesystem, final-summary, find-backlog-root, id-generation, implementation-notes-append, implementation-notes, implementation-plan, mcp-definition-of-done-defaults, mcp-documents, mcp-drafts, mcp-final-summary, mcp-milestones, mcp-refs-docs, mcp-task-complete, mcp-task-type-filtering, mcp-tasks, parent-id-normalization, prefix-migration, references, remote-id-conflict, search-service, start-id, status-callback, tab-switching, task-edit-preservation, task-path, task-type, unified-view-loading, view-switcher, and worktree-refresh. BACK-535.3 owns filesystem-only mechanical conversion; BACK-535.4 owns server, watcher, client, child-process, and dependent fixture teardown.

Timeout audit: config-hang-repro had the only unowned rejecting Promise.race and is repaired here. atomic-task-create had a non-rejecting losing sleep timer and now uses the shared self-clearing withTimeout helper. The two main-branch ContentStore rejecting Promise.race helpers are already owned and repaired by BACK-533/PR #757, so this slice deliberately does not duplicate that pending change. Existing config-watcher, build, and mcp-stdio timeout helpers already clear timers on operation settlement; their resource shutdown remains scoped to BACK-535.4.

Implemented the bounded lifecycle slice: config-hang-repro now allocates a unique project path, cleans it without swallowing teardown failures, and uses the shared self-clearing withTimeout helper. atomic-task-create now uses the same helper instead of leaving a losing sleep timer alive. Added focused helper tests for resolve, reject, and timeout paths. Updated doc-001 through the Backlog CLI with isolation, cleanup, resource ownership, synchronization, global-state, surface assertion, platform, and verification rules. No production file changed.

Verification before review: 10 repeated focused runs passed 15/15 each with 32 assertions in 0.39-0.40s. config-hang-repro alone remained 7/7 and measured 0.11-0.14s after versus 0.12-0.14s before. Full isolated suite passed 1,625 tests with 2 expected interactive-TUI skips, 0 failures, 6,631 assertions across 189 files in 154.91s; prior main baseline was 1,625 tests in 160.66s, so the two new helper tests produce 1,627 total with no measurable runtime regression. TypeScript, Biome over 323 files, build, and diff checks pass.

Post-main fail-first evidence: after merging origin/main 75c2528, atomic-task-create failed 1 of 30 identical focused runs because both unlocked creates sometimes fulfilled. The barrier proves both calls reached saveTask concurrently, but filesystem scheduling may let one write replace the other before duplicate ambiguity is observable. Therefore the >=1 rejection assertion is probabilistic and overstates the documented USE_GLOBAL_TASK_ID_LOCK=false escape-hatch contract. The deterministic replacement will retain direct concurrent-entry evidence, await both operations, and require every rejection (if any) to be AmbiguousTaskIdError.

Post-repair verification on merged main 75c2528: the direct escape-hatch contract passed 50/50 atomic stress runs and the combined timeout/config/atomic focus passed 10/10 (15 tests, 32 assertions per run). Full suite passed 1,636 with 2 intentional interactive-TUI skips, 0 failures, and 6,716 assertions across 189 files in 169.72s. bunx tsc --noEmit, Biome over 323 files, bun run build, and diff checks passed. The higher total relative to the earlier 1,625 baseline comes from main changes merged through #759 plus the two helper tests.

Specification-review repairs: doc-001 now prefers framework teardown hooks and gives an AggregateError pattern that preserves both primary and cleanup failures for in-test resources. The undocumented USE_GLOBAL_TASK_ID_LOCK=false case is explicitly an internal test of FileSystem.withCreateLock; it now directly proves two operations enter and resolve without serialization, with no patched persistence or vacuous allSettled assertions. The adjacent persisted-state test, serializes create-time writes and assigns unique ids by default, remains the shipped default-behavior coverage and asserts TASK-1/TASK-2; duplicate-task-repair and task-path retain fail-closed duplicate coverage. BACK-535.3 now names exactly 13 setup and 53 filesystem teardown files, excludes 17 exact BACK-535.4 resource-owning files, and requires actual Windows GitHub Actions evidence. BACK-535.4 was reconciled to own those 17 files. Re-verification: 50/50 atomic internal stress, 10/10 combined focus (15 tests, 31 assertions), full suite 1,636 pass plus 2 intentional skips and 0 failures across 189 files in 165.77s, 6,715 assertions; tsc, Biome over 323 files, build, and diff checks pass.

Quality-review inventory correction: the original 89-site count covered broad block catches only and is superseded. An exact current-main scan for block catches, empty catches, Promise .catch calls, and shared test helpers found 145 sites. Every site is now assigned once: 37 redundant pre-clean sites and 58 filesystem-only teardown sites to BACK-535.3; 24 resource-owning cleanup/pre-clean sites to BACK-535.4; and 26 explicit exclusions below. Counts reconcile: 37 + 58 + 24 + 26 = 145. BACK-535.3 now includes previously missed claude-agent-install setup/teardown, cli-root-entry teardown, and pre-clean sites paired with already listed teardown files such as agent-instructions and config-commands.

Explicit expected-error/assertion exclusions (16): src/test/core.test.ts:193; src/test/acceptance-criteria.test.ts:385 and :400; src/test/offline-mode.test.ts:75; src/test/duplicate-task-repair.test.ts:88, :428, :495, and :536; src/test/offline-integration.test.ts:143; src/test/dependency.test.ts:28; src/test/board-config-simple.test.ts:72, :131, and :183, where intentionally incomplete mocks may throw after the progress assertion; and src/test/cli.test.ts:473, :733, and :762.

Explicit justified fallback/diagnostic exclusions (10): src/test/cli-init-no-git.test.ts:17 returns false for an existence probe; src/test/mcp-workspace-root.test.ts:52 returns an empty list for a missing task directory; src/test/tui-interactive-editor-handoff.test.ts:86 optionally falls back when /dev/tty is unavailable, :188 supplies missing transcript diagnostics, :192 rethrows a richer diagnostic error rather than swallowing, and :203/:204 supply optional editor diagnostic content; src/test/build.test.ts:68 records the last bounded server-start retry error and :115 rethrows except for the named cross-filesystem build limitation; src/test/test-utils.ts:65 is the shared bounded retry helper that retains the last attempt error and rethrows it after exhaustion.

Shared withTimeout coverage now directly spies on clearTimeout for both early resolution and early rejection and restores the global spy in finally. The internal legacy escape-hatch test now releases held operations in finally, attaches allSettled before assertions, drains both outcomes without replacing a primary assertion failure, and then asserts the two exact fulfilled values.

Quality-review fix verification: timeout plus atomic tests passed 50/50 repeated runs; the combined timeout/config/atomic focus passed 10/10 with 16 tests and 33 assertions per run. Full suite passed 1,637 with 2 intentional interactive-TUI skips, 0 failures, and 6,717 assertions across 189 files in 169.69s. bunx tsc --noEmit, Biome over 323 files, bun run build, and diff checks passed. The added test is the separate early-rejection cancellation assertion; no production files changed.

Final inventory-boundary correction: the 144-site scan covered test files only. Shared test infrastructure adds src/test/test-utils.ts:65, where retry() catches each bounded attempt, retains the last error, and rethrows it after exhaustion. This is the 26th explicit justified/assertion site. The complete inventory is therefore 145 = 37 BACK-535.3 pre-clean + 58 BACK-535.3 teardown + 24 BACK-535.4 resource cleanup + 26 explicit expected/justified sites.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
