---
id: task-345.03
title: Update file system operations for configurable prefixes
status: Done
assignee:
  - '@codex'
created_date: '2026-01-03 20:43'
updated_date: '2026-01-04 23:13'
labels:
  - enhancement
  - refactor
  - filesystem
dependencies:
  - task-345.01
parent_task_id: task-345
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Update file system operations to use configurable glob patterns instead of hardcoded `task-*.md`.

### Key Files
- `src/file-system/operations.ts`
- `src/utils/task-path.ts` - getTaskPath, getDraftPath, getTaskFilename

### Implementation
1. Update `listTasks()` to use `buildGlobPattern(config.prefixes.task)`
2. Update `listCompletedTasks()` to use configured task prefix
3. Update `listArchivedTasks()` to use configured task prefix
4. Update `listDrafts()` to scan for `draft-*.md` only (breaking change)
5. Update `saveDraft()` to use draft prefix in filename
6. Update `getTaskPath()` to use configured task prefix
7. Update `getDraftPath()` to scan for draft prefix only
8. Update `getTaskFilename()` to use configured prefix

### Breaking Change
Existing drafts with `task-` prefix will no longer appear in draft listings. Users should manually rename or recreate them.

### Tests (in same PR)
- Test listTasks with custom prefix
- Test listDrafts finds draft- prefixed files
- Test saveDraft creates draft- prefixed files
- Test file operations work with default config

### Docs (in same PR)
- Document breaking change in release notes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 listTasks uses configured task prefix glob pattern
- [x] #2 listDrafts scans for draft-*.md only (no backward compat)
- [x] #3 saveDraft creates files with draft- prefix
- [x] #4 getTaskPath uses configured task prefix
- [x] #5 getDraftPath finds draft- prefixed files only
- [x] #6 Tests verify custom prefix file operations
- [x] #7 Breaking change documented in release notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Pre-Implementation Context (from Session 2)

### What's Already Done (TASK-345.01 & TASK-345.02)

1. **PrefixConfig abstraction** (`src/utils/prefix-config.ts`):
   - `normalizeId(id, prefix)` → uppercase canonical ID (e.g., "TASK-123")
   - `idForFilename(id)` → lowercase for filenames (e.g., "task-123")
   - `buildGlobPattern(prefix)` → returns "prefix-*.md"
   - `buildIdRegex(prefix)` → regex for matching IDs
   - `buildFilenameIdRegex(prefix)` → regex for filename parsing
   - `getPrefixForType(EntityType, config?)` → returns prefix for entity type
   - `generateNextId(existingIds, prefix)` → generates next ID in sequence

2. **EntityType enum** (`src/types/index.ts`):
   ```typescript
   export enum EntityType {
     Task = "task",
     Draft = "draft", 
     Document = "document",
     Decision = "decision",
   }
   ```

3. **ID Format Convention**:
   - Canonical IDs: UPPERCASE (TASK-123, DRAFT-5)
   - Filenames: lowercase prefix (task-123 - Title.md, draft-5 - Title.md)
   - Use `normalizeId()` for canonical form
   - Use `idForFilename()` when building file paths

4. **generateNextId in Core** (`src/core/backlog.ts`):
   - Already updated to accept `EntityType` parameter
   - `generateNextId(EntityType.Draft)` will scan drafts folder
   - Returns uppercase ID like "DRAFT-1"

### Key Files to Modify

1. **`src/file-system/operations.ts`**:
   - `listDrafts()` - currently uses hardcoded pattern, needs `buildGlobPattern("draft")`
   - `saveDraft()` - already uses `idForFilename()`, but ID comes in as task- prefixed
   - `loadDraft()` - needs to find draft- prefixed files
   - `listTasks()`, `listCompletedTasks()`, `listArchivedTasks()` - may need prefix from config

2. **`src/utils/task-path.ts`**:
   - `getDraftPath()` - needs to use draft prefix for filename matching
   - Already imports: `normalizeId`, `buildFilenameIdRegex`, `idForFilename`

3. **`src/core/backlog.ts`**:
   - `createDraft()` - needs to use `EntityType.Draft` for ID generation
   - Currently has TODO comment about this

### Implementation Steps

1. **Update `listDrafts()` in operations.ts**:
   ```typescript
   // Change from:
   const files = glob.sync("task-*.md", { cwd: this.draftsDir });
   // To:
   const files = glob.sync(buildGlobPattern("draft"), { cwd: this.draftsDir });
   ```

2. **Update `saveDraft()` in operations.ts**:
   - The draft ID should already be DRAFT-X format when passed in
   - `idForFilename()` will convert to "draft-x" for filename
   - Verify this works correctly

3. **Update `loadDraft()` in operations.ts**:
   - Uses `getDraftPath()` which needs updating
   - Should find files matching `draft-*.md` pattern

4. **Update `getDraftPath()` in task-path.ts**:
   - Currently may use task prefix pattern
   - Change to use "draft" prefix for matching

5. **Update `createDraft()` in backlog.ts**:
   - Find the TODO comment about EntityType.Draft
   - Change `generateNextId()` call to use `EntityType.Draft`

6. **Update CLI draft create** (if needed):
   - May have hardcoded task- prefix logic

### Testing Strategy

1. Run existing draft tests first to see what breaks:
   ```bash
   bun test --test-name-pattern "draft" --timeout 60000
   ```

2. Update test expectations:
   - Draft IDs should be "DRAFT-1", "DRAFT-2", etc.
   - Filenames should be "draft-1 - Title.md"

3. Key test files to update:
   - `src/test/core.test.ts` - draft operations tests
   - `src/test/mcp-*.test.ts` - if they test draft creation
   - Any tests checking draft filenames or IDs

### Verification Commands
```bash
bunx tsc --noEmit                      # TypeScript check
bun run check .                        # Lint
bun test --test-name-pattern "draft"   # Draft-specific tests
CLAUDECODE=1 bun test --timeout 180000 # Full suite
```

### Git State
- Branch: `tasks/task-345-draft-prefix`
- 5 commits ahead of origin (not pushed)
- All tests currently pass

### Breaking Change Notice
Existing drafts with `task-` prefix will NOT be found after this change. This is intentional per user confirmation. Document in release notes.

## Breaking Change Documentation

### Draft ID Prefix Change

**Breaking Change:** Drafts now use `draft-` prefix instead of `task-` prefix.

**Impact:**
- Draft IDs are now `DRAFT-X` (uppercase) instead of `TASK-X`
- Draft filenames are now `draft-x - Title.md` (lowercase) instead of `task-x - Title.md`
- `listDrafts()` only finds `draft-*.md` files
- Existing drafts with `task-` prefix will NOT be found

**Migration Required:**
Users must manually rename existing draft files from `task-*.md` to `draft-*.md` format, or recreate them. A migration utility will be provided in task-345.08.

**Note on Demote/Promote:**
The `demoteTask()` operation moves files to drafts/ but keeps the `task-` prefix. Similarly, `promoteDraft()` moves files to tasks/ but keeps the `draft-` prefix. Full ID reassignment during promote/demote is handled by task-345.07.

## Implementation Summary

1. Updated `listDrafts()` to scan for `draft-*.md` pattern
2. Updated `saveDraft()` to normalize IDs with draft prefix
3. Updated `loadDraft()` to find draft-prefixed files
4. Updated `archiveDraft()` and `promoteDraft()` to find draft-prefixed files
5. Updated `getDraftPath()` in task-path.ts for draft prefix
6. Updated `createTaskFromData()` and `createTaskFromInput()` to use EntityType.Draft
7. Updated Core commit messages to use proper draft ID normalization
8. Updated all draft-related tests to use DRAFT-X format
<!-- SECTION:NOTES:END -->
