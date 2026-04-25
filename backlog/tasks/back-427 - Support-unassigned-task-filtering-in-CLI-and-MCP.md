---
id: BACK-427
title: Support unassigned task filtering in CLI and MCP
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - cli
  - mcp
  - filters
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/557'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #557: allow users and agents to list tasks with no assignee.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI task list can filter for tasks with no assignee.
- [ ] #2 MCP task_list exposes an equivalent unassigned filter without overloading a real assignee value ambiguously.
- [ ] #3 Help text, schemas, and tests cover the new filter.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
