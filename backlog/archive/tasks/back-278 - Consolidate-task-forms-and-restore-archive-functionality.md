---
id: BACK-278
title: Consolidate task forms and restore archive functionality
status: To Do
assignee: []
created_date: '2025-09-26 19:25'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI currently uses two different components for task management: TaskForm for creating new tasks and TaskDetailsModal for editing existing tasks. This duplication makes maintenance harder and the archive functionality was accidentally lost when TaskDetailsModal replaced TaskForm for editing (task-247). TaskDetailsModal provides a superior UX with its preview mode, inline editing, and organized layout. We should consolidate by extending TaskDetailsModal to handle both create and edit modes, add back the archive button in the right sidebar, and remove the redundant TaskForm component.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Make task prop optional in TaskDetailsModal to support create mode
- [ ] #2 Add title field editing when in create mode (currently title is only in header)
- [ ] #3 Add onArchive prop and handler to TaskDetailsModal interface
- [ ] #4 Add archive button at bottom of right sidebar (below Dependencies section)
- [ ] #5 Show archive button only when editing existing task, not when creating
- [ ] #6 Update App.tsx to use TaskDetailsModal for both create and edit modes
- [ ] #7 Handle form validation for required fields when creating new task
- [ ] #8 Preserve all existing UX improvements (preview mode, inline editing, keyboard shortcuts)
- [ ] #9 Test both create and edit flows work correctly with all features
- [ ] #10 Remove TaskForm component after migration is complete
<!-- AC:END -->
