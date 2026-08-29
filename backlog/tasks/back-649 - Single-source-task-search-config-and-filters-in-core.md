---
id: BACK-649
title: Single-source task search config and filters in core
status: To Do
assignee: []
created_date: '2026-08-29 21:04'
labels:
  - cli
  - mcp
  - web
dependencies: []
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task search is implemented three times with real behavior drift: core SearchService (cross-branch, scores), utils createTaskSearchIndex (local one-shot, duplicated Fuse config verbatim), and a private browser Fuse in MilestonesPage. The bodyText builders differ (task-search includes labels and assignees in searchable text; SearchService does not), so the same query finds a task via task list --search and MCP but not via backlog search or the web API. Label filtering is any/all in one path, any-only in another, all-only in the MCP draft path. Stage 1 of the unification: make utils/task-search.ts the single owner of the searchable-entity builder and the Fuse key/weight/threshold config, consumed by SearchService for its task portion, and fold the three non-query filter implementations (Core.applyTaskFilters, task-search filters, SearchService filters) into one set of shared predicates with the labelMatch divergence resolved explicitly. Labels and assignees become searchable text everywhere (maintainer-approved direction). The local vs cross-branch corpus split stays a deliberate caller decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One module owns the Fuse config and searchable-text builder; SearchService imports it and its duplicated config is deleted
- [ ] #2 A query matching a label or assignee finds the task identically via backlog search, task list --search, MCP, and the web API
- [ ] #3 One shared filter implementation with explicitly resolved labelMatch semantics; divergent copies deleted
- [ ] #4 Tests pin the cross-surface parity, including the labels and assignees cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
