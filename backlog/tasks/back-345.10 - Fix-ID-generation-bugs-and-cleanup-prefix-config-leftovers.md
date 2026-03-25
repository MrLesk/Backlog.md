---
id: BACK-345.10
title: Fix ID generation bugs and cleanup prefix-config leftovers
status: Done
assignee:
  - '@codex'
created_date: '2026-01-14 19:54'
updated_date: '2026-01-14 20:14'
labels:
  - bug
  - refactor
  - tdd
dependencies: []
parent_task_id: '345'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Code review identified bugs introduced during the configurable prefix refactor (task-345). These bugs cause ID collisions in specific scenarios:

1. **P1 - Subtask case-sensitivity**: Mixed-case IDs from legacy data cause `startsWith()` to fail, leading to duplicate subtask IDs
2. **P1 - Draft promotion ignores completed tasks**: `FileSystem.promoteDraft` uses `listTasks()` (active only) instead of the comprehensive ID scanning in `Core.generateNextId`

Additionally, there are cleanup items:
3. **P2 - Duplicated `escapeRegex`**: Same function in `prefix-config.ts` and `task-path.ts`
4. **P3 - Unused `draft` field in PrefixConfig**: The field exists but is never read from config (always uses hardcoded "draft")

### Context
These bugs exist because the refactor created two divergent ID generation paths. Tests pass because they don't cover legacy/mixed-case scenarios. The "silent knowledge" that ID generation must scan all non-archived states was violated.

### Related
- Parent: task-345 (Configurable ID prefix system)
- Article context: https://mrlesk.com/blog/instructions-following-discovery/
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Test: subtask generation with mixed-case legacy IDs correctly detects existing subtasks
- [x] #2 Test: draft promotion with completed tasks does not reuse completed task IDs
- [x] #3 Fix: subtask ID detection uses case-insensitive comparison
- [x] #4 Fix: FileSystem.promoteDraft delegates to Core.generateNextId or includes completed tasks
- [x] #5 Cleanup: single escapeRegex function exported from prefix-config.ts
- [x] #6 Cleanup: remove unused `draft` field from PrefixConfig interface
- [x] #7 All existing tests continue to pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## TDD Implementation Plan

### Phase 1: Write Failing Tests (RED)

**1.1 Subtask mixed-case test** (`src/test/id-generation.test.ts`)
```typescript
it("should detect existing subtasks with different casing (legacy data)", async () => {
  // Simulate legacy lowercase file by directly writing to filesystem
  // Then create new subtask via Core - should get TASK-1.2, not TASK-1.1
});
```

**1.2 Draft promotion with completed tasks test** (`src/test/filesystem.test.ts`)
```typescript
it("should not reuse completed task IDs when promoting draft", async () => {
  // Create and complete TASK-1
  // Ensure no active tasks
  // Promote draft - should get TASK-2, not TASK-1
});
```

### Phase 2: Fix Bugs (GREEN)

**2.1 Fix subtask case-sensitivity** (`src/core/backlog.ts:448`)
- Change `id.startsWith()` to case-insensitive comparison
- Options:
  a) Normalize both sides: `id.toUpperCase().startsWith(normalizedParent.toUpperCase() + ".")`
  b) Use regex with 'i' flag
  
**2.2 Fix draft promotion** (`src/file-system/operations.ts:430-445`)
- Options:
  a) Have `promoteDraft` accept a Core instance and delegate to `Core.generateNextId`
  b) Add `listCompletedTasks()` to existing ID collection in `promoteDraft`
  c) Move promote/demote logic entirely to Core layer (cleanest)
- Recommendation: Option (c) - Core should own all ID generation

### Phase 3: Cleanup (REFACTOR)

**3.1 Consolidate escapeRegex**
- Export from `src/utils/prefix-config.ts`
- Import in `src/utils/task-path.ts`
- Delete duplicate definition

**3.2 Remove unused draft field**
- Remove `draft: string` from `PrefixConfig` interface in `src/types/index.ts`
- Remove from `DEFAULT_PREFIX_CONFIG` in `src/utils/prefix-config.ts`
- Update `mergePrefixConfig()` to not include draft
- Update migration to not write draft field
- Update tests that reference `config.prefixes.draft`

### Phase 4: Verify (All tests pass)
```bash
bunx tsc --noEmit
bun run check .
CLAUDECODE=1 bun test --timeout 180000
```

### Files to Modify
- `src/core/backlog.ts` - Fix subtask case-sensitivity
- `src/file-system/operations.ts` - Fix/remove promoteDraft ID generation
- `src/utils/prefix-config.ts` - Export escapeRegex, remove draft from default
- `src/utils/task-path.ts` - Import escapeRegex
- `src/types/index.ts` - Remove draft from PrefixConfig
- `src/core/prefix-migration.ts` - Update migration
- `src/test/id-generation.test.ts` - Add mixed-case test
- `src/test/filesystem.test.ts` - Add completed task collision test
- `src/test/prefix-config.test.ts` - Update PrefixConfig tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Bugs Fixed

**P1 - Subtask case-sensitivity** (`src/core/backlog.ts:448-450`)
- Changed `id.startsWith()` to case-insensitive comparison
- Now uses `id.toUpperCase().startsWith()` to handle legacy lowercase IDs

**P1 - Draft promotion ignoring completed tasks** (`src/file-system/operations.ts:440-444`)
- Added `listCompletedTasks()` to the ID collection in `promoteDraft`
- Now scans both active and completed tasks before generating new ID

### Cleanup Completed

**Consolidated escapeRegex function**
- Exported from `src/utils/prefix-config.ts`
- Imported in `src/utils/task-path.ts`
- Removed duplicate definition

**Removed unused draft field from PrefixConfig**
- Removed `draft: string` from `PrefixConfig` interface
- Added `DRAFT_PREFIX = "draft"` constant for hardcoded draft prefix
- Updated `DEFAULT_PREFIX_CONFIG`, `mergePrefixConfig()`, `getPrefixForType()`
- Updated migration and all tests

### Tests Added
- `id-generation.test.ts`: "should detect existing subtasks with different casing (legacy data)"
- `filesystem.test.ts`: "should not reuse completed task IDs when promoting draft"

### Files Modified
- `src/core/backlog.ts` - Case-insensitive subtask detection
- `src/file-system/operations.ts` - Include completed tasks in promoteDraft
- `src/utils/prefix-config.ts` - Export escapeRegex, add DRAFT_PREFIX constant
- `src/utils/task-path.ts` - Import escapeRegex
- `src/types/index.ts` - Remove draft from PrefixConfig
- `src/core/init.ts` - Remove draft from prefixes
- `src/core/prefix-migration.ts` - Remove draft from migration
- `src/test/*.ts` - Updated 5 test files
<!-- SECTION:NOTES:END -->
