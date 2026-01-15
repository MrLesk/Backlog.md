---
id: BACK-203
title: Show meaningful description in web kanban
status: Done
assignee:
  - '@claude'
created_date: '2025-07-25'
updated_date: '2025-07-26'
labels:
  - frontend
  - enhancement
dependencies: []
priority: medium
---

## Description

Improve the web kanban board's task preview by removing the raw '## Description' header and displaying the actual task description content instead. This enhancement will make the web kanban view more informative and less cluttered.

Related to: https://github.com/MrLesk/Backlog.md/issues/233

## Acceptance Criteria

- [x] Raw '## Description' header is stripped from task preview in web kanban view
- [x] Actual task description content is displayed in web kanban cards
- [x] Task preview shows meaningful context (first ~100-150 characters of description)
- [x] Preview text is properly truncated with ellipsis if needed
- [x] Web kanban view maintains clean visual appearance

## Implementation Plan

1. **Locate web kanban card component**: Find the component that renders task cards in the web kanban view
2. **Parse task content**: Identify how task content is currently being parsed and displayed
3. **Strip headers**: Implement logic to remove '## Description' header from the content
4. **Extract description**: Parse and extract the actual description text
5. **Add truncation**: Implement text truncation logic with ellipsis for descriptions over 100-150 characters
6. **Test changes**: Verify the web kanban view displays meaningful descriptions correctly
7. **Clean up**: Ensure code follows project standards and passes linting

## Implementation Notes

- Modified `TaskCard.tsx` component to extract and display meaningful description content
- Added `extractDescription` function that uses regex to extract content after the "## Description" header
- Added `truncateText` function to limit description to 120 characters with ellipsis
- The implementation handles edge cases: tasks without Description headers and empty bodies
- All build checks pass successfully (TypeScript, Biome linting, and production build)
