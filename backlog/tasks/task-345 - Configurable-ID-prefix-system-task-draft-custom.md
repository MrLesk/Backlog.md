---
id: task-345
title: 'Configurable ID prefix system (task-, draft-, custom)'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-12-16 20:18'
updated_date: '2026-01-05 13:13'
labels:
  - enhancement
  - refactor
  - id-generation
  - drafts
dependencies: []
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Currently all tasks use hardcoded `task-` prefix (e.g., `task-42`). This makes it impossible to:
1. Distinguish drafts from tasks at a glance (original request)
2. Use custom prefixes like `JIRA-`, `issue-`, `bug-` for teams with existing conventions
3. Integrate with external systems that use different ID schemas

### What
Implement a configurable prefix system that:
- Allows custom prefixes for tasks (default: `task-`)
- Uses `draft-` prefix for drafts (solves original issue)
- Maintains backward compatibility with existing `task-` projects
- Enables future Jira/external system integration (see GitHub issue #392)

### Related GitHub Issues
- #392 - Sync between Jira and Backlog.md (would benefit from custom prefixes)

### Scope
This is a **parent task** that coordinates the refactor across multiple areas. 
Actual implementation is split into subtasks, each with its own tests and docs.

### Impact Areas Identified
1. ID generation & normalization (`src/utils/task-path.ts`, `src/core/backlog.ts`)
2. File system operations (`src/file-system/operations.ts`)
3. Task path resolution (`src/utils/task-path.ts`)
4. Task sorting (`src/utils/task-sorting.ts`)
5. Content store (`src/core/content-store.ts`)
6. Task loaders (`src/core/task-loader.ts`, `src/core/cross-branch-tasks.ts`)
7. Search services (`src/core/search-service.ts`, `src/utils/task-search.ts`)
8. UI components (`src/ui/*.ts`, `src/cli.ts`)
9. ~500+ test references
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All subtasks (task-345.01 through task-345.07) completed
- [ ] #2 Drafts use draft- prefix by default
- [ ] #3 Custom task prefixes configurable via config.yml
- [ ] #4 All tests pass including new prefix-related tests
- [ ] #5 Documentation updated for prefix configuration
- [ ] #6 Breaking change for existing task- prefixed drafts documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Foundation
- **task-345.01** - Create PrefixConfig abstraction layer (BLOCKING - all others depend on this)

### Phase 2: Core Refactoring (can run in parallel after 345.01)
- **task-345.02** - Update ID generation and normalization utilities
- **task-345.03** - Update file system operations for configurable prefixes
- **task-345.04** - Update task loaders for configurable prefixes
- **task-345.05** - Update sorting, content store, and search
- **task-345.06** - Update UI components and CLI

### Phase 3: Draft-Specific Features
- **task-345.07** - Implement promote/demote with ID reassignment (depends on 345.02, 345.03)

### Dependency Graph
```
task-345.01 (PrefixConfig)
    ├── task-345.02 (ID generation)
    │       └── task-345.07 (promote/demote) ←─┐
    ├── task-345.03 (File system) ─────────────┘
    ├── task-345.04 (Task loaders)
    ├── task-345.05 (Sorting/Search)
    └── task-345.06 (UI/CLI)
```

### Related GitHub Issues
- #392 - Jira sync (will benefit from custom prefixes)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress as of 2026-01-03

**Completed:**
- task-345.01 (PrefixConfig abstraction) - DONE
- Created 8 subtasks total (345.01-345.08)
- Branch: `tasks/task-345-draft-prefix`
- Commit: `13dd3e7`

**Next steps:**
- task-345.02 (ID generation) or task-345.03 (file system ops)
- Both depend only on 345.01 which is done
- task-345.08 (migration) was added per user request

**Key files created:**
- `src/utils/prefix-config.ts` - Core helpers
- `src/test/prefix-config.test.ts` - 52 tests

## Notes for Future Self

**Key design decisions:**
1. NO backward compatibility for drafts - breaking change is OK (user confirmed)
2. Separate ID counters for tasks vs drafts (draft-5 promoted → task-N, not task-5)
3. `src/utils/prefix-config.ts` has ALL the helpers you need - use them!

**Watch out for:**
- ~500 hardcoded `task-` references in tests - update systematically
- `normalizeTaskId()` in `task-path.ts` will conflict with new `normalizeId()` - refactor to use new one
- UI components filter with `.startsWith("task-")` - need prefix-aware check

**Testing strategy:**
- Run `bun test src/test/prefix-config.test.ts` first (fast, 52 tests)
- Then `bunx tsc --noEmit` for type checking
- Full suite: `CLAUDECODE=1 bun test --timeout 180000`

**Don't forget:**
- task-345.08 (migration) must run AFTER 345.03 (file system ops)
- Each subtask includes its own tests - don't batch them

## Session 2 Update (2026-01-04)

**Completed:** task-345.02 (ID generation and normalization)

**Key implementation details:**
- IDs are now UPPERCASE: TASK-123, TASK-ACCESSOR, DRAFT-5
- Filenames use lowercase prefix: task-123 - Title.md
- `normalizeId(id, prefix)` → uppercase canonical ID
- `idForFilename(id)` → lowercase for filenames
- Search service updated for case-insensitive ID matching

**Commits:**
- `993d050` - TASK-345.02 - Implement uppercase IDs with lowercase filename prefixes
- `20a523c` - TASK-345.02 - Add implementation notes for session 2

**Next task to work on:** task-345.03 (File system operations)
- Need to update saveDraft/loadDraft to use draft- prefix
- Use EntityType.Draft with generateNextId()
- File operations already use idForFilename() - just need draft prefix support

**Branch:** tasks/task-345-draft-prefix (4 commits ahead of origin)

## Quick Reference - Available Helpers

**From `src/utils/prefix-config.ts`:**
```typescript
import {
  normalizeId,           // (id, prefix) → "TASK-123"
  idForFilename,         // (id) → "task-123" (lowercase)
  buildGlobPattern,      // (prefix) → "prefix-*.md"
  buildIdRegex,          // (prefix) → /^prefix-(\d+)/i
  buildFilenameIdRegex,  // (prefix) → for filename parsing
  extractIdBody,         // (id, prefix) → "123" (without prefix)
  extractIdNumbers,      // (id, prefix) → [5, 2, 1] for "task-5.2.1"
  hasPrefix,             // (id, prefix) → boolean
  idsEqual,              // (id1, id2, prefix) → boolean
  generateNextId,        // (existingIds, prefix) → "PREFIX-N"
  generateNextSubtaskId, // (existingIds, parentId, prefix) → "PREFIX-5.3"
  getPrefixForType,      // (EntityType, config?) → prefix string
  DEFAULT_PREFIX_CONFIG, // { task: "task", draft: "draft" }
} from "../utils/prefix-config.ts";
```

**From `src/utils/task-path.ts`:**
```typescript
import {
  normalizeTaskId,  // (id, prefix?) → "TASK-123" (convenience wrapper)
  taskIdsEqual,     // (left, right, prefix?) → boolean
  extractTaskBody,  // (value, prefix?) → body without prefix
  getTaskPath,      // async (taskId, core?) → file path or null
  getDraftPath,     // async (draftId, core?) → file path or null  
  getTaskFilename,  // async (taskId, core?) → filename or null
} from "../utils/task-path.ts";
```

**EntityType enum** (`src/types/index.ts`):
```typescript
export enum EntityType {
  Task = "task",
  Draft = "draft",
  Document = "document",
  Decision = "decision",
}
```

## Session 3 Completion (2026-01-05)

**Completed tasks:**
- task-345.06 - UI components and CLI updates
- task-345.07 - Promote/demote with ID reassignment
- task-345.08 - Draft prefix migration on config load

**Summary:**
Configurable ID prefix system is now fully implemented:
- IDs are uppercase (TASK-123, DRAFT-5)
- Filenames use lowercase (task-123.md, draft-5.md)
- Drafts use `draft-` prefix, tasks use `task-` prefix
- Auto-migration renames legacy task-*.md files in drafts folder
- Promote/demote operations reassign IDs (draft → new task ID, task → new draft ID)

**Branch:** tasks/task-345-draft-prefix (7 commits ahead of origin)
<!-- SECTION:NOTES:END -->
