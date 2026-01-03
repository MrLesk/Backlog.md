---
id: task-345
title: 'Configurable ID prefix system (task-, draft-, custom)'
status: In Progress
assignee:
  - '@codex'
created_date: '2025-12-16 20:18'
updated_date: '2026-01-03 20:48'
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
