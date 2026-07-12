---
id: BACK-445
title: Add command filters to web search
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-26 08:19'
updated_date: '2026-04-26 08:26'
labels:
  - web-ui
  - search
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/338'
modified_files:
  - src/web/components/SideNavigation.tsx
  - src/web/utils/search-command-query.ts
  - src/web/lib/api.ts
  - src/server/index.ts
  - src/core/search-service.ts
  - src/test/search-command-query.test.ts
  - src/test/search-service.test.ts
  - src/test/server-search-endpoint.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add field:value command filters to the browser search experience so users can narrow tasks, documents, and decisions by structured fields while preserving existing text search behavior. This replaces the outdated task-263 reference from PR #338, which conflicts with current BACK task IDs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Browser search supports field:value command filters for task fields such as status, priority, assignee, and labels.
- [x] #2 Command filters can be combined with free-text search without breaking existing text search results.
- [x] #3 Search behavior handles unknown or malformed command filters predictably without crashing the UI.
- [x] #4 The PR title and task references use the current BACK task ID format.
- [x] #5 Focused automated coverage verifies command parsing/filtering and the relevant web search behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebuild PR #338 on current main with the new BACK-445 task ID.
2. Parse sidebar field:value commands into API search parameters while preserving free-text search.
3. Add assignee support to the centralized search filters exposed through /api/search.
4. Cover parser, search service, and search endpoint behavior with focused tests.
5. Push the refreshed PR branch and trigger checks/review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented command parsing for the sidebar search input and routed parsed filters through the existing /api/search endpoint. Added assignee support to the centralized SearchService filter path so status, priority, assignee, labels, type, and modified file command filters can combine with free-text queries. Task-only command filters default sidebar search to task results unless the user supplies an explicit type filter. Unknown or malformed commands are preserved as normal text search terms.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt PR #338 on current main under BACK-445. The browser sidebar now parses field:value search commands, sends structured filters to the centralized search API, and keeps unknown or malformed command tokens as plain text. The shared search service and API now support assignee filters, with focused parser/service/API coverage plus full suite verification.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
