---
id: task-285
title: Add label filter to TUI task list
status: Draft
assignee: []
created_date: '2025-09-07 00:00'
labels:
  - tui
  - filters
  - labels
  - ui
dependencies:
  - task-259
priority: medium
---

## Description

Extend the TUI task list view with a label-based filter so users can quickly narrow down tasks by one or more labels. Reuse the filtering patterns introduced for status and priority, but adapt the UI to support selecting labels. Consider how to present multiple selections in the limited footer space while keeping the interaction simple.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI task list provides a label filter control that lists all labels referenced in visible tasks and backlog configuration
- [ ] #2 Users can select and clear one or more labels, and the task list updates immediately to show tasks matching any selected label
- [ ] #3 Label filter state persists for the duration of the TUI session and resets on exit
- [ ] #4 Filtering integrates with existing status and priority filters without conflicts
- [ ] #5 Unit tests cover label filtering logic; TUI interaction is covered by integration or snapshot tests as appropriate
- [ ] #6 Biome checks and TypeScript type-checking pass
<!-- AC:END -->

## Implementation Plan (Optional)

- Review existing filter implementations in the TUI for reusable components and patterns
- Add label filtering logic to the task list data source, ensuring combinations with status/priority remain performant
- Update the TUI controls to expose label selection while maintaining minimal footprint in the footer
- Write tests covering filter combinations and edge cases such as tasks without labels
- Update documentation if necessary to mention the new filter
