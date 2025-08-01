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

Refactored server component to eliminate separation of concerns violations by moving all business logic to Core class. The server previously duplicated ID generation, auto-commit logic, markdown parsing, and direct git operations.

Key changes:
- Moved sophisticated `generateNextId` from CLI to Core, removing server's simplified duplicate version
- Created `core.createTaskFromData()` to handle task construction instead of manual object building in server
- Added `core.updateDecisionFromContent()` and `core.updateDocument()` for proper business logic encapsulation
- Replaced direct git operations with `core.updateTasksBulk()` for consistent transactional handling
- Made Core's `shouldAutoCommit` public to eliminate server duplicate

Server handlers are now significantly simplified (e.g., `handleCreateTask` reduced from 25 lines to 3) and focus purely on HTTP concerns. All 448 tests pass with zero breaking changes to existing API endpoints.
