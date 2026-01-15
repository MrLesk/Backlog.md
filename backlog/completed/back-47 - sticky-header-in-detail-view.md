---
id: BACK-47
title: Sticky header in detail view
status: Done
assignee: []
created_date: '2025-06-11'
updated_date: '2025-06-13'
labels:
  - enhancement
dependencies: []
---

## Description

Goal: Keep task header visible while scrolling body.

Detailed work:
- Extract header (id, status, date, tags) into its own box, top:0, height:3, scrollable:false; let body scroll beneath.

## Acceptance Criteria
- [x] Scrolling the body never moves the header (pixel diff or DOM test).

## Implementation Notes

Successfully implemented a sticky header in the task detail view by restructuring the UI layout:

### Key Changes Made:
- **Fixed Header**: Created a non-scrollable header box at top:0, height:3 containing task ID, title, status, creation date, assignee, and labels
- **Scrollable Body**: Replaced separate metadata, description, and acceptance criteria boxes with a single scrollable container positioned below the header (top:3)
- **Unified Content**: Combined all task details into a single scrollable body that flows seamlessly while keeping the most important metadata always visible

### Technical Implementation:
- Modified `refreshDetailPane()` function in `/Users/agavr/projects/Backlog.md/src/ui/task-viewer.ts`
- Header box has `scrollable: false` ensuring it never moves
- Body container starts at `top: 3` and fills remaining space with `height: "100%-4"`
- Updated focus management to handle the new two-pane structure (task list + body)
- Maintained all existing functionality while improving the user experience

### Benefits:
- Users can always see task identity (ID, title, status) while reading long descriptions
- Important metadata (assignee, labels, dates) remains visible during scrolling
- Improved navigation and reference capability when working with detailed task content
- Cleaner, more focused UI that reduces cognitive load
