---
id: task-345.05
title: 'Update sorting, content store, and search for configurable prefixes'
status: To Do
assignee: []
created_date: '2026-01-03 20:43'
labels:
  - enhancement
  - refactor
  - search
dependencies:
  - task-345.01
parent_task_id: task-345
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Update task sorting, content store filtering, and search services to handle configurable prefixes.

### Key Files
- `src/utils/task-sorting.ts` - parseTaskId, compareTaskIds, sortByTaskId
- `src/core/content-store.ts` - File filtering logic
- `src/core/search-service.ts` - TASK_ID_PREFIX constant
- `src/utils/task-search.ts` - TASK_ID_PREFIX constant
- `src/server/index.ts` - TASK_ID_PREFIX constant

### Implementation
1. Update `parseTaskId()` to strip any configured prefix
2. Update `sortByTaskId()` to work with any prefix
3. Update content store file filtering to use configured prefix
4. Replace TASK_ID_PREFIX constants with config-based approach
5. Update search ID matching to use configured prefix

### Tests (in same PR)
- Test sorting with custom prefixes (JIRA-1, JIRA-2, JIRA-10)
- Test content store filters correct files
- Test search finds tasks with custom prefixes

### Docs (in same PR)
- Document sorting behavior with custom prefixes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 parseTaskId strips any configured prefix correctly
- [ ] #2 sortByTaskId sorts custom-prefixed IDs numerically (JIRA-2 before JIRA-10)
- [ ] #3 Content store filters files using configured prefix
- [ ] #4 Search service uses configured prefix for ID matching
- [ ] #5 TASK_ID_PREFIX constants replaced with config-based approach
- [ ] #6 Tests verify sorting and search with custom prefixes
<!-- AC:END -->
