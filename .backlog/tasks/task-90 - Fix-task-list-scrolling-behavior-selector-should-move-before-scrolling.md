---
id: task-90
title: Fix task list scrolling behavior - selector should move before scrolling
status: In Progress
assignee:
  - '@claude'
created_date: '2025-06-19'
updated_date: '2025-06-19'
labels:
  - bug
  - ui
dependencies: []
---

## Description

The task list view currently has incorrect scrolling behavior. When navigating down from the first task, the view scrolls immediately while keeping the cursor on the first item, which feels unnatural. The expected behavior (as seen in the board view) is that the cursor should move down through all visible items first, and only start scrolling when the cursor reaches the bottom of the visible area. This provides a more intuitive navigation experience.

## Acceptance Criteria

- [ ] Cursor should move down through visible items before scrolling starts
- [ ] Scrolling should only begin when cursor reaches the bottom of the visible area
- [ ] Scrolling should maintain cursor at bottom while moving through remaining items
- [ ] Match the scrolling behavior of the board view
- [ ] Test scrolling with lists longer than the visible area

## Implementation Plan

1. Analyze the board view's scrolling implementation to understand correct behavior
2. Compare with current generic list component scrolling behavior
3. Modify generic list component to implement proper cursor-before-scroll behavior
4. Ensure scrolling starts only when cursor reaches the visible area boundary
5. Test with various list sizes to ensure smooth scrolling experience
6. Verify the fix doesn't break other uses of generic list component
