---
id: task-345.03
title: Update file system operations for configurable prefixes
status: To Do
assignee: []
created_date: '2026-01-03 20:43'
updated_date: '2026-01-03 20:48'
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
- [ ] #1 listTasks uses configured task prefix glob pattern
- [ ] #2 listDrafts scans for draft-*.md only (no backward compat)
- [ ] #3 saveDraft creates files with draft- prefix
- [ ] #4 getTaskPath uses configured task prefix
- [ ] #5 getDraftPath finds draft- prefixed files only
- [ ] #6 Tests verify custom prefix file operations
- [ ] #7 Breaking change documented in release notes
<!-- AC:END -->
