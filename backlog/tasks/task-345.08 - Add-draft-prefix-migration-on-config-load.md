---
id: task-345.08
title: Add draft prefix migration on config load
status: Done
assignee:
  - '@codex'
created_date: '2026-01-03 20:56'
updated_date: '2026-01-05 12:46'
labels:
  - enhancement
  - migration
  - drafts
dependencies:
  - task-345.01
  - task-345.03
parent_task_id: task-345
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
When loading a project config that doesn't have a `prefixes:` section, run a one-time migration to:
1. Add the prefixes section to config.yml
2. Rename existing `task-*.md` files in the drafts folder to `draft-*.md`
3. Update IDs inside those files using `generateNextId("draft")`

### Key Files
- **New:** `src/core/prefix-migration.ts` - Migration logic (separate file)
- **Modify:** `src/core/backlog.ts` - Call migration on config load

### Implementation
1. Create `migrateDraftPrefixes(fs: FileSystem)` function in separate file
2. Scan drafts folder for `task-*.md` files
3. For each file:
   - Generate new draft ID using `generateNextDraftId()`
   - Update the ID in the file content (frontmatter)
   - Rename the file to use `draft-` prefix
4. Add `prefixes: { task: "task", draft: "draft" }` to config.yml
5. Call migration from Core when config is loaded and missing prefixes section

### Tests (in same PR)
- Test migration creates prefixes section
- Test migration renames task- files to draft- in drafts folder
- Test migration updates IDs inside files
- Test migration is idempotent (doesn't run twice)
- Test migration handles empty drafts folder

### Docs (in same PR)
- Document migration behavior
- Add note in release notes about automatic migration
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Migration runs automatically when prefixes section missing from config
- [ ] #2 Migration adds prefixes section to config.yml
- [ ] #3 Migration renames task-*.md to draft-*.md in drafts folder
- [ ] #4 Migration updates IDs inside files to use draft- prefix
- [ ] #5 Migration is idempotent (safe to run multiple times)
- [ ] #6 Migration logic in separate file (prefix-migration.ts)
- [ ] #7 Tests verify all migration scenarios
<!-- AC:END -->
