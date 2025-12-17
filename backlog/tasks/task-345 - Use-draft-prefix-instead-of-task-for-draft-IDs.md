---
id: task-345
title: Use draft- prefix instead of task- for draft IDs
status: To Do
assignee: []
created_date: '2025-12-16 20:18'
updated_date: '2025-12-17 22:11'
labels:
  - drafts
  - id-generation
  - enhancement
dependencies: []
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Currently drafts use the same `task-` prefix as regular tasks (e.g., `task-42`). This makes it harder to distinguish drafts from tasks at a glance and in file listings.

### What
Change draft ID generation to use `draft-` prefix instead of `task-`:
- Drafts should be created with IDs like `draft-1`, `draft-42`, etc.
- Tasks should continue using `task-` prefix
- When a draft is promoted to a task, it should get a new `task-` ID
- When a task is demoted to a draft, it should get a new `draft-` ID

### Key Files (from investigation)
- `/src/core/backlog.ts` - `generateNextId()` (lines 394-467) - main ID generation logic
- `/src/file-system/operations.ts` - `saveDraft()`, `promoteDraft()`, `demoteTask()`
- `/src/utils/task-path.ts` - `getDraftPath()` uses glob pattern `task-*.md`
- `/src/cli.ts` - draft commands

### Considerations
- Need separate ID counters for drafts vs tasks, or shared counter with different prefix
- Promote/demote operations need to handle ID reassignment
- Existing drafts with `task-` prefix may need migration or backward compatibility
<!-- SECTION:DESCRIPTION:END -->
