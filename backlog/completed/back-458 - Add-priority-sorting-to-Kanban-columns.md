---
id: BACK-458
title: Add priority sorting to Kanban columns
status: Done
assignee: []
created_date: '2026-05-02 07:42'
updated_date: '2026-05-02 07:42'
labels: []
dependencies: []
priority: high
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Column header should have a menu button
- [ ] #2 Dropdown menu should have 'Sort by Priority' option
- [ ] #3 Tasks in column should be reordered by High > Medium > Low > None
- [ ] #4 New order should be persisted to Markdown files via ordinals
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a new 'Sort by Priority' action in the Kanban column header menu. This feature allows users to vertically reorder tasks within a stack by priority (High > Medium > Low > None), with the new order being persisted to the Markdown files using the existing reorder/ordinal system. Updated TaskColumn.tsx to include the UI for the column actions menu and the associated sorting logic.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
