---
id: BACK-345.02
title: Update ID generation and normalization utilities
status: Done
assignee:
  - '@codex'
created_date: '2026-01-03 20:43'
updated_date: '2026-01-04 22:16'
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

## Session 2 - Completing Uppercase ID Implementation

### Context
Continued from previous session where ID generation/normalization was updated. This session fixed all failing tests after the uppercase ID change.

### Key Issue Discovered
The `normalizeId()` function was only uppercasing the prefix ("TASK-") but not the body. For ID "task-accessor", it produced "TASK-accessor" instead of "TASK-ACCESSOR".

### Fixes Applied

1. **normalizeId() in prefix-config.ts**
   - Changed from: `return \`${upperPrefix}-${body}\``
   - Changed to: `return \`${upperPrefix}-${body.toUpperCase()}\``
   - Now entire ID is uppercase: TASK-123, TASK-ACCESSOR, TASK-DRAFT

2. **Search Service (search-service.ts)**
   - Made `parseTaskIdSegments()` case-insensitive by lowercasing input
   - Updated `createTaskIdVariants()` to:
     - Use lowercase for prefix matching
     - Add individual numeric segments as variants (for short-query matching)
     - Include both original and lowercased ID forms
   - This allows searching "7" to find "TASK-0007"

3. **File Operations (operations.ts)**
   - `saveTask()` normalizes task.id and task.parentTaskId to uppercase before serialization
   - Uses `idForFilename()` for lowercase filename: `task-123 - Title.md`
   - Same pattern for `saveDraft()`

4. **Path Resolution (task-path.ts)**
   - `getTaskPath()`, `getDraftPath()`, `getTaskFilename()` use `idForFilename()` for filename matching
   - Pattern: files stored as lowercase, IDs returned as uppercase

5. **Core Operations (backlog.ts)**
   - Commit messages use `normalizeTaskId()` for uppercase: "backlog: Archive task TASK-123"
   - `reorderTask()` normalizes taskId and orderedTaskIds at method start

### Test Files Updated (to expect uppercase IDs)
- board-loading.test.ts: TASK-1, TASK-2, TASK-3, TASK-4
- cli-incrementing-ids.test.ts: TASK-1 through TASK-10
- cli-parent-filter.test.ts: TASK-1.1, TASK-1.2, TASK-2
- core.test.ts: TASK-DRAFT, TASK-ACCESSOR, TASK-1 through TASK-5
- id-generation.test.ts: TASK-1 through TASK-7, TASK-5.1
- mcp-task-complete.test.ts: TASK-1
- mcp-tasks.test.ts: TASK-1, TASK-2
- offline-integration.test.ts: TASK-1, TASK-2
- parent-id-normalization.test.ts: TASK-123
- prefix-config.test.ts: TASK-123, JIRA-456, etc.
- reorder-utils.test.ts: TASK-1, TASK-2, TASK-3
- search-service.test.ts: TASK-1, TASK-2, TASK-3
- server-search-endpoint.test.ts: TASK-0007, TASK-0008
- task-path.test.ts: TASK-1, TASK-123

### Commit
```
993d050 TASK-345.02 - Implement uppercase IDs with lowercase filename prefixes
```

### Design Pattern Summary
- **Canonical ID format**: Uppercase (TASK-123, DRAFT-5, TASK-ACCESSOR)
- **Filename format**: Lowercase prefix (task-123 - Title.md, draft-5 - Title.md)
- **Conversion helpers**:
  - `normalizeId(id, prefix)` → uppercase canonical ID
  - `idForFilename(id)` → lowercase for filenames
  - `normalizeTaskId(id)` → convenience wrapper using "task" prefix

### Verification
- All tests pass (exit code 0)
- TypeScript compiles without errors
- Biome lint/format checks pass
<!-- SECTION:NOTES:END -->
