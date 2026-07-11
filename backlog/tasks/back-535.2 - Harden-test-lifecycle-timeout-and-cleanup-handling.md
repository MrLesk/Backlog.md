---
id: BACK-535.2
title: 'Harden test lifecycle, timeout, and cleanup handling'
status: In Progress
assignee:
  - '@test-hygiene-slice-b'
created_date: '2026-07-11 09:20'
updated_date: '2026-07-11 09:26'
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
1. Inventory and classify every broad catch/swallow site and all rejecting timeout races.
2. Introduce or reuse the smallest self-cleaning timeout pattern and repair config-hang-repro isolation.
3. Convert only high-risk setup/teardown sites that currently hide lifecycle failures.
4. Update the Testing Style Guide and create scoped child follow-ups for remaining mechanical batches.
5. Run repeated focused stress, full/static/build checks, record runtime evidence, and complete sequential reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Catch/swallow audit reconciled the BACK-535 baseline of 89 sites. Slice A removed two cli-dependency sites: one redundant setup pre-clean and one swallowed teardown. The remaining exact scan found 87: 70 swallowed teardown/resource cleanups, 13 redundant setup pre-cleans, 3 justified best-effort probes, and 1 expected-error assertion. Therefore the original baseline classifies as 71 teardown/resource, 14 setup pre-clean, 3 justified, and 1 expected-error assertion.

Redundant setup files: acceptance-criteria-structured, cleanup, cli-dependency (removed by Slice A), cli-milestone-filter, cli-parent-filter, cli-plain-create-edit, cli-plain-output, cli-refs-docs, cli-task-milestone, cli-zero-padded-ids, cli, desc-alias, description-newlines, and draft-create-consistency. Justified best-effort probes: cli-init-no-git pathExists returns false, mcp-workspace-root missing task directory returns an empty list, and tui-interactive-editor-handoff optionally falls back when /dev/tty cannot be opened. Expected-error assertion: cli checks a missing required directory by failing the assertion inside the stat catch.

Swallowed teardown/resource files: acceptance-criteria-structured, acceptance-criteria, agent-instructions, append-implementation-notes, auto-commit, board-command, board-loading, build, cleanup, cli-agents, cli-auto-plain-non-tty, cli-board-integration, cli-commit-behaviour, cli-dependency (removed by Slice A), cli-final-summary, cli-incrementing-ids, cli-init-no-git, cli-milestone-filter, cli-parent-filter, cli-plain-create-edit, cli-plain-output, cli-refs-docs, cli-task-milestone, cli-task-type, cli-task-wizard, cli-zero-padded-ids, cli, comments, config-commands, content-store, core, definition-of-done-cli, definition-of-done, desc-alias, description-newlines, documentation, draft-create-consistency, editor, enhanced-init, filesystem, final-summary, find-backlog-root, id-generation, implementation-notes-append, implementation-notes, implementation-plan, mcp-definition-of-done-defaults, mcp-documents, mcp-drafts, mcp-final-summary, mcp-milestones, mcp-refs-docs, mcp-task-complete, mcp-task-type-filtering, mcp-tasks, parent-id-normalization, prefix-migration, references, remote-id-conflict, search-service, start-id, status-callback, tab-switching, task-edit-preservation, task-path, task-type, unified-view-loading, view-switcher, and worktree-refresh. BACK-535.3 owns filesystem-only mechanical conversion; BACK-535.4 owns server, watcher, client, child-process, and dependent fixture teardown.

Timeout audit: config-hang-repro had the only unowned rejecting Promise.race and is repaired here. atomic-task-create had a non-rejecting losing sleep timer and now uses the shared self-clearing withTimeout helper. The two main-branch ContentStore rejecting Promise.race helpers are already owned and repaired by BACK-533/PR #757, so this slice deliberately does not duplicate that pending change. Existing config-watcher, build, and mcp-stdio timeout helpers already clear timers on operation settlement; their resource shutdown remains scoped to BACK-535.4.

Implemented the bounded lifecycle slice: config-hang-repro now allocates a unique project path, cleans it without swallowing teardown failures, and uses the shared self-clearing withTimeout helper. atomic-task-create now uses the same helper instead of leaving a losing sleep timer alive. Added focused helper tests for resolve, reject, and timeout paths. Updated doc-001 through the Backlog CLI with isolation, cleanup, resource ownership, synchronization, global-state, surface assertion, platform, and verification rules. No production file changed.

Verification before review: 10 repeated focused runs passed 15/15 each with 32 assertions in 0.39-0.40s. config-hang-repro alone remained 7/7 and measured 0.11-0.14s after versus 0.12-0.14s before. Full isolated suite passed 1,625 tests with 2 expected interactive-TUI skips, 0 failures, 6,631 assertions across 189 files in 154.91s; prior main baseline was 1,625 tests in 160.66s, so the two new helper tests produce 1,627 total with no measurable runtime regression. TypeScript, Biome over 323 files, build, and diff checks pass.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
