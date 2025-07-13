---
id: task-183
title: Add ordinal field for custom task ordering in web UI
status: To Do
assignee: []
created_date: '2025-07-13'
updated_date: '2025-07-13'
labels: []
dependencies: []
priority: high
---

## Description

Enable drag-and-drop task reordering within columns in the web UI. When a user drags a task to a new position within the same column, automatically assign ordinal values to maintain the custom order. The system needs: 1) Frontend drag-and-drop within columns, 2) Server API to handle reordering and persist changes, 3) CLI command for setting ordinal values, 4) Automatic ordinal assignment for all tasks in affected column, 5) File system updates to save ordinal values in task frontmatter.
## Acceptance Criteria

- [ ] Add ordinal field to task frontmatter schema
- [ ] Implement drag-and-drop reordering within same column in web UI
- [ ] Create server API endpoint to handle task reordering requests
- [ ] Add CLI command 'backlog task edit --ordinal <number>' for manual ordinal setting
- [ ] Automatically assign ordinal values to all tasks in column when drag occurs
- [ ] Update task sorting logic: ordinal first then fallback to current ordering
- [ ] Save ordinal values to task markdown files via CLI from server
- [ ] Tasks with ordinal appear at top in numerical order
- [ ] Tasks without ordinal maintain current ordering as fallback
- [ ] Drag-and-drop works smoothly with visual feedback during drag
