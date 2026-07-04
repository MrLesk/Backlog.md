---
id: BACK-355.01
title: 'Core: Add type field to task domain model and persistence'
status: In Progress
assignee:
  - '@alex-agent'
created_date: '2026-01-01 23:37'
updated_date: '2026-07-04 14:05'
labels:
  - core
dependencies: []
parent_task_id: BACK-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the foundational type field to the Task interface and implement persistence in markdown YAML frontmatter. This is the foundation that all other subtasks depend on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task interface includes optional 'type' field with union type: 'bug' | 'feature' | 'enhancement' | 'task' | 'chore' | 'docs' | 'spike'
- [x] #2 TaskCreateInput and TaskUpdateInput interfaces include type field
- [x] #3 Task parser reads type from YAML frontmatter (defaults to 'task' if missing)
- [x] #4 Task writer persists type to YAML frontmatter
- [x] #5 BacklogConfig interface includes 'types' array for project-level customization
- [x] #6 Default types array is defined in config defaults
- [x] #7 Unit tests verify type field CRUD operations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add optional type?: string to Task, TaskCreateInput, TaskUpdateInput (string, not closed union, because the allowed set is config-overridable; mirrors TaskStatus).
2. Add DEFAULT_TASK_TYPES constant (bug, feature, enhancement, task, chore, docs, spike) next to DEFAULT_STATUSES.
3. Add optional types?: string[] to BacklogConfig; parse/serialize 'types: [...]' in config.yml mirroring the statuses key (absent key = defaults, no config migration).
4. Parser: read frontmatter 'type' as optional string (absent stays undefined - untyped, per approved design; no 'task' default injection).
5. Serializer: emit 'type' in frontmatter next to priority, omitted when unset.
6. Core validation on write: normalizeTaskType helper (mirrors normalizePriority + canonical-casing match like statuses) used by createTaskFromInput and applyTaskUpdateInput; clear error listing allowed values; empty string clears the field. Include type in updated_date relevance comparison.
7. Tests: CRUD round-trip, validation failure, config override, absent-field back-compat, config round-trip.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core implementation complete: Task/TaskCreateInput/TaskUpdateInput.type (optional string), DEFAULT_TASK_TYPES constant, BacklogConfig.types + config.yml 'types' key (parse/serialize), frontmatter 'type' parse/serialize next to priority, normalizeTaskType write validation (canonical casing, clear error listing allowed values, empty string clears), type included in updated_date relevance check. 12 unit tests in src/test/task-type.test.ts covering CRUD round-trip, validation failure, config override, and absent-field back-compat.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @alex-agent
created: 2026-07-04 14:05
---
Implementation note on ACs 1 and 3, per the approved BACK-355 design review: the allowed type set is project-configurable (config key 'types'), so Task.type is an optional string validated on write against the configured set (DEFAULT_TASK_TYPES fallback: bug, feature, enhancement, task, chore, docs, spike) rather than a closed TS union; and a missing 'type' key stays undefined (untyped) instead of defaulting to 'task' - no migration of existing tasks. Frontmatter key: 'type'.
---
<!-- COMMENTS:END -->
