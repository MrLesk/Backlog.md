---
id: task-345.07
title: Implement promote/demote with ID reassignment
status: To Do
assignee: []
created_date: '2026-01-03 20:43'
labels:
  - enhancement
  - drafts
dependencies:
  - task-345.02
  - task-345.03
parent_task_id: task-345
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Update promote/demote operations to reassign IDs when moving between draft and task states.

### Key Files
- `src/file-system/operations.ts` - promoteDraft, demoteTask
- `src/core/backlog.ts` - promoteDraft, demoteTask methods

### Implementation
1. Update `promoteDraft()` to:
   - Generate new task- ID using generateNextId()
   - Update task.id in content
   - Save with new task- filename
   - Delete old draft- file
2. Update `demoteTask()` to:
   - Generate new draft- ID using generateNextDraftId()
   - Update task.id in content
   - Save with new draft- filename
   - Delete old task- file
3. Handle edge cases (ID conflicts, file rename failures)

### Tests (in same PR)
- Test promoteDraft changes draft-N to task-M
- Test demoteTask changes task-N to draft-M
- Test ID sequence continuity after promote/demote
- Test file cleanup after operations

### Docs (in same PR)
- Document ID reassignment behavior
- Add examples in CLI help text
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 promoteDraft generates new task- ID (not keeping draft- ID)
- [ ] #2 demoteTask generates new draft- ID (not keeping task- ID)
- [ ] #3 Old files are properly deleted after promote/demote
- [ ] #4 ID sequences remain consistent (no gaps, no conflicts)
- [ ] #5 Tests verify ID reassignment on promote
- [ ] #6 Tests verify ID reassignment on demote
- [ ] #7 Documentation explains ID reassignment behavior
<!-- AC:END -->
