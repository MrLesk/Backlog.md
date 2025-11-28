---
id: task-321
title: Status change callbacks in task frontmatter
status: To Do
assignee:
  - '@codex'
created_date: '2025-11-18 19:31'
updated_date: '2025-11-28 20:03'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow tasks to define shell command callbacks that run automatically when task status changes. Commands execute from the project repository root when status updates are triggered through Backlog.md workflows.

**Configuration levels:**
1. **Global** (in backlog config): `onStatusChange` setting applies to all tasks
2. **Per-task** (in frontmatter): `onStatusChange` overrides global setting for that task

**Variable injection:**
Commands can use these variables:
- `$TASK_ID` - The task identifier (e.g., "task-321")
- `$OLD_STATUS` - Previous status (e.g., "To Do")
- `$NEW_STATUS` - New status (e.g., "In Progress")
- `$TASK_TITLE` - The task title

**Example global config:**
```yaml
onStatusChange: 'echo "Task $TASK_ID moved from $OLD_STATUS to $NEW_STATUS"'
```

**Example per-task frontmatter:**
```yaml
onStatusChange: 'claude "Task $TASK_ID has been moved to $NEW_STATUS from $OLD_STATUS. Please take over it"'
```

**Working directory:** Commands execute from the project repository root.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Global config supports `onStatusChange` bash command that runs on any task status change
- [ ] #2 Task frontmatter supports `onStatusChange` to override global setting for that specific task
- [ ] #3 Commands have access to `$TASK_ID`, `$OLD_STATUS`, `$NEW_STATUS`, and `$TASK_TITLE` variables
- [ ] #4 Commands execute from the project repository root directory

- [ ] #5 Callback failures are reported without blocking status change persistence
- [ ] #6 Documentation explains global and per-task configuration with examples
<!-- AC:END -->
