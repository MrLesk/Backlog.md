---
id: task-345.02
title: Update ID generation and normalization utilities
status: Done
assignee:
  - '@codex'
created_date: '2026-01-03 20:43'
updated_date: '2026-01-03 22:08'
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
- [x] #1 normalizeTaskId accepts optional prefix parameter
- [x] #2 generateNextId accepts EntityType parameter (replaces separate normalizeDraftId/generateNextDraftId)
- [x] #3 extractTaskBody handles any prefix pattern
- [x] #4 getPrefixForType helper returns correct prefix for each EntityType
- [x] #5 Existing generateNextId works unchanged (backward compatible)
- [x] #6 Unit tests for all modified/new functions
- [x] #7 JSDoc updated with prefix parameter documentation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Changes Made

1. **Added EntityType enum** (`src/types/index.ts`)
   - `Task`, `Draft`, `Document`, `Decision` variants
   - Used for type-safe ID generation

2. **Added getPrefixForType helper** (`src/utils/prefix-config.ts`)
   - Returns configurable prefix for Task (from config)
   - Returns hardcoded prefixes for Draft ("draft"), Document ("doc"), Decision ("decision")

3. **Updated generateNextId** (`src/core/backlog.ts`)
   - New signature: `generateNextId(type: EntityType = EntityType.Task, parent?: string)`
   - Uses `getPrefixForType` for prefix resolution
   - Uses `buildIdRegex` for prefix-aware matching
   - Added `getExistingIdsForType` helper for folder scanning by type

4. **Updated task-path.ts functions**
   - `normalizeTaskId(id, prefix = "task")` - delegates to `normalizeId`
   - `extractTaskBody(value, prefix = "task")` - prefix-aware extraction
   - `extractTaskIdFromFilename(filename, prefix = "task")` - uses `buildFilenameIdRegex`
   - `taskIdsEqual(left, right, prefix = "task")` - prefix-aware comparison

5. **Added unit tests**
   - 7 new tests for `getPrefixForType` in prefix-config.test.ts
   - 7 new tests for custom prefix support in task-path.test.ts

### Design Decisions

- Only tasks have configurable prefix (from config.prefixes.task)
- Draft, Document, Decision use hardcoded prefixes
- Default prefix is "task" for backward compatibility
- Task folder scanning: /tasks, /completed, cross-branch (if enabled), remote (if enabled)
- Archived tasks excluded from ID scanning (per user specification)

### Notes for Future Tasks

- **task-345.03**: File system operations need updating (saveDraft, loadDraft, etc.) to use draft- prefix
- CLI draft create has TODO comment to switch to EntityType.Draft when 345.03 is complete
- Current draft creation still uses task- prefix until file system operations are updated
<!-- SECTION:NOTES:END -->
