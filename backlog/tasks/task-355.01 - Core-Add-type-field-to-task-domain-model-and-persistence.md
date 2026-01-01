---
id: task-355.01
title: 'Core: Add type field to task domain model and persistence'
status: To Do
assignee: []
created_date: '2026-01-01 23:37'
labels:
  - core
dependencies: []
parent_task_id: task-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the foundational type field to the Task interface and implement persistence in markdown YAML frontmatter. This is the foundation that all other subtasks depend on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task interface includes optional 'type' field with union type: 'bug' | 'feature' | 'enhancement' | 'task' | 'chore' | 'docs' | 'spike'
- [ ] #2 TaskCreateInput and TaskUpdateInput interfaces include type field
- [ ] #3 Task parser reads type from YAML frontmatter (defaults to 'task' if missing)
- [ ] #4 Task writer persists type to YAML frontmatter
- [ ] #5 BacklogConfig interface includes 'types' array for project-level customization
- [ ] #6 Default types array is defined in config defaults
- [ ] #7 Unit tests verify type field CRUD operations
<!-- AC:END -->
