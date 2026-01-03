---
id: task-345.01
title: Create PrefixConfig abstraction layer
status: To Do
assignee: []
created_date: '2026-01-03 20:43'
labels:
  - enhancement
  - refactor
  - id-generation
dependencies: []
parent_task_id: task-345
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Create the foundational abstraction layer for configurable ID prefixes. This is the core building block that all other subtasks depend on.

### Key Files
- **New:** `src/utils/prefix-config.ts` - Core abstraction
- **Modify:** `src/types/index.ts` - Add types
- **Modify:** `src/core/backlog.ts` - Load prefix config

### Implementation
1. Define `PrefixConfig` interface with `task` and `draft` prefix fields
2. Add config schema to `BacklogConfig` type
3. Create helper functions:
   - `getDefaultPrefixConfig()` - Returns `{ task: "task", draft: "draft" }`
   - `normalizeId(id: string, prefix: string)` - Generic ID normalization
   - `extractIdNumber(id: string, prefix: string)` - Extract numeric part
   - `buildGlobPattern(prefix: string)` - Returns `${prefix}-*.md`
   - `buildIdRegex(prefix: string)` - Returns regex for ID matching
4. Load prefix config in Core initialization with defaults

### Tests (in same PR)
- Unit tests for all helper functions
- Test default config loading
- Test custom config loading
- Test backward compatibility (missing config = defaults)

### Docs (in same PR)
- JSDoc for all exported functions
- Update config.yml schema documentation
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrefixConfig interface defined with task and draft fields
- [ ] #2 Helper functions created: normalizeId, extractIdNumber, buildGlobPattern, buildIdRegex
- [ ] #3 Default config returns { task: "task", draft: "draft" }
- [ ] #4 Config loads from backlog/config.yml with fallback to defaults
- [ ] #5 Unit tests cover all helper functions
- [ ] #6 JSDoc documentation added for all exports
<!-- AC:END -->
