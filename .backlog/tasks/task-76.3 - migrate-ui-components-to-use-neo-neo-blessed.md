---
id: task-76.3
title: Migrate UI components to use neo-neo-blessed
status: To Do
assignee: []
created_date: '2025-06-16'
labels:
  - refactoring
  - ui
  - migration
dependencies: []
parent_task_id: task-76
---

## Description

Migrate all UI components from blessed to neo-neo-blessed, updating import statements and adapting to any API changes identified in the assessment phase.

Key areas to migrate:
- Board view (`/src/ui/board.ts`)
- Task viewer (`/src/ui/task-viewer.ts`)
- Generic list component (`/src/ui/components/generic-list.ts`)
- TUI main file (`/src/ui/tui.ts`)
- All other UI components using blessed

This involves:
- Updating all import statements from CommonJS to ESM syntax
- Adapting code to handle any API differences
- Ensuring event handlers work correctly
- Maintaining existing functionality and behavior

## Acceptance Criteria

- [ ] Update all blessed imports to neo-neo-blessed using ESM syntax
- [ ] Migrate board view component to neo-neo-blessed
- [ ] Migrate task viewer component to neo-neo-blessed
- [ ] Migrate generic list component to neo-neo-blessed
- [ ] Update TUI main file to use neo-neo-blessed
- [ ] Fix any API incompatibilities identified during migration
- [ ] Ensure all event handlers (keyboard, mouse) work correctly
- [ ] Verify screen rendering and layout remain consistent
- [ ] Update any custom blessed extensions or patches
- [ ] Remove any CJS-specific import workarounds
