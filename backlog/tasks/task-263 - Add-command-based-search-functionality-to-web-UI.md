---
id: task-263
title: Add command-based search functionality to web UI
status: To Do
assignee: ['@seunghwan']
created_date: '2025-09-09 08:56'
updated_date: '2025-09-09 08:56'
labels: ['enhancement', 'web-ui', 'search']
priority: High
dependencies: []
---

## Description

Implement dynamic filtering search in SideNavigation component that allows users to search using field:value syntax (e.g., status:Done, priority:High, assignee:user1) combined with regular text search using Fuse.js

## Acceptance Criteria

- [ ] Search with field:value syntax works correctly
- [ ] status:Done filters tasks by status
- [ ] priority:High filters tasks by priority
- [ ] assignee:user1 filters tasks by assignee
- [ ] labels:bug filters tasks by labels
- [ ] Combined search like 'status:Done add feature' works
- [ ] Regular text search still works without field:value syntax
- [ ] Search results display correctly in unified view

## Implementation Plan

1. Create search utility functions for parsing field:value syntax
2. Modify SideNavigation component to detect command syntax
3. Implement dynamic filtering logic for different field types
4. Integrate with existing Fuse.js search for hybrid functionality
5. Test all search combinations and edge cases
6. Ensure backward compatibility with existing search

## Implementation Notes

- Created `src/web/utils/searchUtils.ts` with parsing and filtering functions
- Modified `src/web/components/SideNavigation.tsx` to support command-based search
- Added support for status, priority, assignee, and labels filtering
- Maintained compatibility with existing Fuse.js text search
- All acceptance criteria have been implemented and tested
