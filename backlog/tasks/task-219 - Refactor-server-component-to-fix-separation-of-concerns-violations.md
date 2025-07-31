---
id: task-219
title: Refactor server component to fix separation of concerns violations
status: Done
assignee: []
created_date: '2025-07-31'
labels:
  - refactoring
  - architecture
  - server
dependencies: []
priority: high
---

## Description

Refactor the server layer to eliminate business logic violations and become a proper thin API layer. The server currently duplicates core functionality and contains business logic that belongs in the Core class.

## Acceptance Criteria

- [x] Server delegates all ID generation to Core class generateNextId method instead of using duplicate logic
- [x] Server removes duplicate shouldAutoCommit method and uses Core.shouldAutoCommit method
- [x] Server removes duplicate extractSection method and uses appropriate Core methods where available
- [x] Server removes direct git operations and delegates to Core git methods
- [x] Server removes manual task creation logic and uses Core.createTask exclusively
- [x] Server removes hardcoded date generation logic and delegates to Core methods
- [x] All existing server API endpoints continue to work without breaking changes
- [x] All tests pass after refactoring
- [x] Server layer contains only HTTP concerns (routing parsing responses)
- [x] Business logic is properly encapsulated in Core class

## Implementation Notes

The server's `generateNextId()` method should be removed entirely and replaced with proper delegation to the Core class's ID generation logic.
