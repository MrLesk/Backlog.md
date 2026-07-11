---
id: BACK-535.4
title: Make server and process test teardown deterministic
status: To Do
assignee: []
created_date: '2026-07-11 09:21'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: high
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace swallowed or incomplete shutdown in resource-owning tests after BACK-535.2. Scope includes mcp-final-summary, mcp-milestones, mcp-tasks, mcp-task-complete, mcp-drafts, mcp-task-type-filtering, mcp-refs-docs, mcp-documents, mcp-definition-of-done-defaults, mcp-stdio-exit, build, config-watcher, cli-board-integration, and board-command. Stop servers/watchers, close clients/streams, kill and await children, then clean fixture directories without masking the primary test result.
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
