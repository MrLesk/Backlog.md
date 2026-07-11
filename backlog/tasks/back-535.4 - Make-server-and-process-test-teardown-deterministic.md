---
id: BACK-535.4
title: Make server and process test teardown deterministic
status: To Do
assignee: []
created_date: '2026-07-11 09:21'
updated_date: '2026-07-11 10:58'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: high
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace swallowed or incomplete shutdown in resource-owning tests after BACK-535.2. The complete 146-site test-infrastructure catch scan assigns these 24 swallowed cleanup/pre-clean sites to this task: src/test/mcp-task-complete.test.ts:42, src/test/worktree-refresh.test.ts:28, src/test/mcp-drafts.test.ts:44, src/test/mcp-task-type-filtering.test.ts:49, src/test/mcp-milestones.test.ts:69, src/test/mcp-stdio-exit.test.ts:184, src/test/build.test.ts:81, :88, :177, and :207, src/test/mcp-final-summary.test.ts:42, src/test/cli-board-integration.test.ts:15 and :58, src/test/board-command.test.ts:15, :75, :107, and :108, src/test/search-service.test.ts:70, src/test/mcp-refs-docs.test.ts:42, src/test/mcp-tasks.test.ts:48 and :1195, src/test/mcp-definition-of-done-defaults.test.ts:44, src/test/mcp-documents.test.ts:44, and src/test/content-store.test.ts:62.

The owned files are src/test/board-command.test.ts, src/test/build.test.ts, src/test/cli-board-integration.test.ts, src/test/config-watcher.test.ts, src/test/content-store.test.ts, src/test/mcp-definition-of-done-defaults.test.ts, src/test/mcp-documents.test.ts, src/test/mcp-drafts.test.ts, src/test/mcp-final-summary.test.ts, src/test/mcp-milestones.test.ts, src/test/mcp-refs-docs.test.ts, src/test/mcp-stdio-exit.test.ts, src/test/mcp-task-complete.test.ts, src/test/mcp-task-type-filtering.test.ts, src/test/mcp-tasks.test.ts, src/test/search-service.test.ts, and src/test/worktree-refresh.test.ts. Config-watcher has no swallowed catch in the current scan but remains owned because watcher shutdown must be proven deterministic.

Stop servers and watchers, close clients, streams, content stores, and search services, kill and await child processes, remove worktrees safely, then clean fixture directories without masking the primary test result. These sites and files are explicitly excluded from BACK-535.3. The complete distribution is 37 BACK-535.3 pre-clean, 59 BACK-535.3 filesystem teardown, 24 BACK-535.4 resource cleanup, 22 legitimate explicit sites, and four BACK-535.5 vacuous assertion sites.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every owned server, watcher, client, stream, subscription, and child process is deterministically released
- [ ] #2 Shutdown failures remain visible and primary assertion failures remain diagnosable
- [ ] #3 No arbitrary sleeps or timeout increases are used as lifecycle fixes
- [ ] #4 Focused repeated stress and full cross-platform CI pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
