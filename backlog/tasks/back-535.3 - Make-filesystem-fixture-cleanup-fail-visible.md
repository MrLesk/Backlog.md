---
id: BACK-535.3
title: Make filesystem fixture cleanup fail visible
status: To Do
assignee: []
created_date: '2026-07-11 09:21'
updated_date: '2026-07-11 10:24'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: medium
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mechanically remove only the enumerated redundant unique-path pre-clean and swallowed filesystem teardown sites after BACK-535.2 establishes the lifecycle rules.

Owned redundant setup pre-clean sites (the beforeEach rm/safeCleanup catch immediately after createUniqueTestDir): src/test/acceptance-criteria-structured.test.ts, src/test/cleanup.test.ts, src/test/cli-milestone-filter.test.ts, src/test/cli-parent-filter.test.ts, src/test/cli-plain-create-edit.test.ts, src/test/cli-plain-output.test.ts, src/test/cli-refs-docs.test.ts, src/test/cli-task-milestone.test.ts, src/test/cli-zero-padded-ids.test.ts, src/test/cli.test.ts, src/test/desc-alias.test.ts, src/test/description-newlines.test.ts, and src/test/draft-create-consistency.test.ts.

Owned filesystem-only teardown catch sites (the afterEach/afterAll safeCleanup or rm catch): src/test/acceptance-criteria-structured.test.ts, src/test/acceptance-criteria.test.ts, src/test/agent-instructions.test.ts, src/test/append-implementation-notes.test.ts, src/test/auto-commit.test.ts, src/test/board-loading.test.ts, src/test/cleanup.test.ts, src/test/cli-agents.test.ts, src/test/cli-auto-plain-non-tty.test.ts, src/test/cli-commit-behaviour.test.ts, src/test/cli-final-summary.test.ts, src/test/cli-incrementing-ids.test.ts, src/test/cli-init-no-git.test.ts, src/test/cli-milestone-filter.test.ts, src/test/cli-parent-filter.test.ts, src/test/cli-plain-create-edit.test.ts, src/test/cli-plain-output.test.ts, src/test/cli-refs-docs.test.ts, src/test/cli-task-milestone.test.ts, src/test/cli-task-type.test.ts, src/test/cli-task-wizard.test.ts, src/test/cli-zero-padded-ids.test.ts, src/test/cli.test.ts, src/test/comments.test.ts, src/test/config-commands.test.ts, src/test/core.test.ts, src/test/definition-of-done-cli.test.ts, src/test/definition-of-done.test.ts, src/test/desc-alias.test.ts, src/test/description-newlines.test.ts, src/test/documentation.test.ts, src/test/draft-create-consistency.test.ts, src/test/editor.test.ts, src/test/enhanced-init.test.ts, src/test/filesystem.test.ts, src/test/final-summary.test.ts, src/test/find-backlog-root.test.ts, src/test/id-generation.test.ts, src/test/implementation-notes-append.test.ts, src/test/implementation-notes.test.ts, src/test/implementation-plan.test.ts, src/test/parent-id-normalization.test.ts, src/test/prefix-migration.test.ts, src/test/references.test.ts, src/test/remote-id-conflict.test.ts, src/test/start-id.test.ts, src/test/status-callback.test.ts, src/test/tab-switching.test.ts, src/test/task-edit-preservation.test.ts, src/test/task-path.test.ts, src/test/task-type.test.ts, src/test/unified-view-loading.test.ts, and src/test/view-switcher.test.ts.

Explicitly excluded and owned by BACK-535.4 because cleanup depends on a server, watcher, client, stream, child process, content store, search service, or worktree resource: src/test/board-command.test.ts, src/test/build.test.ts, src/test/cli-board-integration.test.ts, src/test/config-watcher.test.ts, src/test/content-store.test.ts, src/test/mcp-definition-of-done-defaults.test.ts, src/test/mcp-documents.test.ts, src/test/mcp-drafts.test.ts, src/test/mcp-final-summary.test.ts, src/test/mcp-milestones.test.ts, src/test/mcp-refs-docs.test.ts, src/test/mcp-stdio-exit.test.ts, src/test/mcp-task-complete.test.ts, src/test/mcp-task-type-filtering.test.ts, src/test/mcp-tasks.test.ts, src/test/search-service.test.ts, and src/test/worktree-refresh.test.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Focused stress and the full local gate pass, and the exact PR head passes the actual GitHub Actions Windows test matrix; Windows-equivalent local evidence is insufficient
- [ ] #2 All 13 enumerated redundant pre-clean operations are removed from unique fixture paths
- [ ] #3 All 53 enumerated filesystem-only teardown failures are fail-visible without changing test behavior
- [ ] #4 No BACK-535.4 server, watcher, client, stream, child-process, content-store, search-service, or worktree site is changed
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the 13 enumerated redundant pre-clean sites only.
2. Convert the 53 enumerated filesystem-only teardown sites to direct fail-visible cleanup, using framework hooks.
3. Confirm no BACK-535.4 resource-owning file changed.
4. Run repeated focused batches locally, full static/build/test gates, then obtain successful GitHub Actions evidence from the actual Windows test matrix.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
