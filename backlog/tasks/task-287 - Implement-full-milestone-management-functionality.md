---
id: task-287
title: Implement full milestone management functionality
status: Done
assignee:
  - '@claude'
created_date: '2025-10-10 19:26'
updated_date: '2025-10-10 20:12'
labels:
  - feature
  - milestone
  - cli
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add complete CRUD operations and filtering capabilities for milestones to match the existing pattern used for documents and decisions. Currently, the milestone field exists in Task type and config, and milestone files exist in backlog/milestones/, but there are no CLI commands to manage them or filter tasks by milestone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestone type defined in src/types/index.ts with id, title, description, status, dates, and rawContent fields
- [x] #2 parseMilestone and serializeMilestone functions implemented in src/markdown/
- [x] #3 FileSystem methods (listMilestones, saveMilestone, loadMilestone) implemented
- [x] #4 Core methods (createMilestone, updateMilestone) implemented with auto-commit support
- [x] #5 CLI commands implemented: milestone create, list, view, edit, archive
- [x] #6 Task create and edit commands support --milestone option to assign tasks to milestones
- [x] #7 Task list command supports -m/--milestone filter to show tasks by milestone
- [x] #8 Search command supports --milestone filter for milestone-specific searches
- [x] #9 Board view supports --milestones flag to group tasks by milestone instead of status
- [x] #10 All milestone operations follow the same patterns as documents and decisions
- [x] #11 Tests added for parsing, serialization, FileSystem, and CLI operations
- [x] #12 Documentation updated with milestone commands and examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Milestone type to src/types/index.ts
2. Implement parseMilestone in src/markdown/parser.ts
3. Implement serializeMilestone in src/markdown/serializer.ts
4. Add FileSystem methods (listMilestones, saveMilestone, loadMilestone)
5. Add Core methods (createMilestone, updateMilestone) with auto-commit
6. Implement CLI milestone commands (create, list, view, edit, archive)
7. Add --milestone option to task create and task edit
8. Add milestone filtering to task list and search
9. Implement board --milestones view
10. Add comprehensive tests
11. Update documentation
<!-- SECTION:PLAN:END -->
