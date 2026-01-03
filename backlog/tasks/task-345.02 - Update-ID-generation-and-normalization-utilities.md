---
id: task-345.02
title: Update ID generation and normalization utilities
status: To Do
assignee: []
created_date: '2026-01-03 20:43'
labels:
  - enhancement
  - refactor
  - id-generation
dependencies:
  - task-345.01
parent_task_id: task-345
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Refactor ID generation and normalization to use the PrefixConfig abstraction.

### Key Files
- `src/utils/task-path.ts` - normalizeTaskId, extractTaskBody, extractTaskIdFromFilename, taskIdsEqual
- `src/core/backlog.ts` - generateNextId method

### Implementation
1. Update `normalizeTaskId()` to accept optional prefix parameter (default: "task")
2. Create `normalizeDraftId()` using prefix config
3. Update `extractTaskBody()` to handle any prefix
4. Update `extractTaskIdFromFilename()` to handle any prefix
5. Add `generateNextDraftId()` method to Core class
6. Refactor `generateNextId()` to accept prefix parameter internally

### Tests (in same PR)
- Test normalizeTaskId with custom prefixes
- Test normalizeDraftId
- Test ID extraction with various prefixes
- Test generateNextId continues to work (backward compat)
- Test generateNextDraftId generates draft-N format

### Docs (in same PR)
- Update JSDoc for modified functions
- Add examples showing custom prefix usage
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 normalizeTaskId accepts optional prefix parameter
- [ ] #2 normalizeDraftId function created using draft prefix
- [ ] #3 extractTaskBody handles any prefix pattern
- [ ] #4 generateNextDraftId method added to Core class
- [ ] #5 Existing generateNextId works unchanged (backward compatible)
- [ ] #6 Unit tests for all modified/new functions
- [ ] #7 JSDoc updated with prefix parameter documentation
<!-- AC:END -->
