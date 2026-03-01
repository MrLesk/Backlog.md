---
id: BACK-400
title: Add milestone filter support to task list (CLI and MCP)
status: To Do
assignee: []
created_date: '2026-03-01 20:26'
updated_date: '2026-03-01 20:28'
labels:
  - cli
  - mcp
  - enhancement
dependencies: []
references:
  - /Users/alex/projects/Backlog.md/src/cli.ts
  - /Users/alex/projects/Backlog.md/src/core/backlog.ts
  - /Users/alex/projects/Backlog.md/src/types/index.ts
  - /Users/alex/projects/Backlog.md/src/mcp/tools/tasks/schemas.ts
  - /Users/alex/projects/Backlog.md/src/mcp/tools/tasks/handlers.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable users and MCP clients to filter tasks by milestone in listing workflows. Milestones are already stored on tasks and listed by milestone tooling, but task-list filters currently cannot query by milestone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI `task list` supports `-m, --milestone <milestone>` and applies milestone filtering alongside existing filters.
- [ ] #2 Core task filtering supports milestone matching as a case-insensitive exact match, consistent with existing status/priority filtering style.
- [ ] #3 MCP `task_list` accepts a `milestone` parameter in its input schema without validation errors.
- [ ] #4 MCP `task_list` applies the milestone filter and returns only tasks whose milestone matches the requested value.
- [ ] #5 Automated tests cover CLI and MCP milestone filter behavior, including case-insensitive matching and combination with at least one existing filter.
- [ ] #6 Existing task listing behavior is unchanged when no milestone filter is provided.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
