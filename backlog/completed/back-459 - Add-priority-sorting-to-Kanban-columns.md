---
id: BACK-459
title: Add priority sorting to Kanban columns
status: Done
assignee:
  - '@codex'
created_date: '2026-05-02 07:42'
updated_date: '2026-05-02 17:58'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/626'
modified_files:
  - src/web/components/TaskColumn.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/web/styles/style.css
priority: high
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Column header should have a menu button
- [x] #2 Dropdown menu should have 'Sort by Priority' option
- [x] #3 Tasks in column should be reordered by High > Medium > Low > None
- [x] #4 New order should be persisted to Markdown files via ordinals
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a column actions menu that emits a full-column reorder payload sorted by priority, reusing the existing task priority sorter. The action delegates persistence to the existing reorder endpoint, which writes ordinals back to the task markdown files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a new 'Sort by Priority' action in the Kanban column header menu. The action reorders tasks by High > Medium > Low > None, sends the sorted task IDs through the existing reorder API, and persists the new order through the existing ordinal system. Added focused React/JSDOM coverage for the emitted reorder payload.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
