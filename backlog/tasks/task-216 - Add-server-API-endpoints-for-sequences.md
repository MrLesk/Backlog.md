---
id: task-216
title: Add server API endpoints for sequences
status: Done
assignee:
  - '@claude'
created_date: '2025-07-27'
updated_date: '2025-07-27'
labels:
  - sequences
  - api
  - backend
dependencies:
  - task-213
---

## Description

Expose sequences to the web UI and support updates when tasks are moved between sequences. Server-side endpoints keep the logic in one place and maintain consistency between interfaces.

## Acceptance Criteria

- [x] Implement a GET /sequences endpoint (or equivalent) that returns the computed sequences as JSON (sequence number and list of task IDs/titles).
- [x] Implement a POST /sequences/move (or similar) endpoint that accepts a task ID and target sequence index and updates task dependencies so the moved task belongs to the chosen sequence (without introducing new task properties).
- [x] Validate input and return appropriate error responses on invalid requests.
- [x] Ensure that updating dependencies via the move endpoint persists changes to the markdown task files using existing file-system operations.
- [x] Add unit tests verifying that the endpoints return correct data and update dependencies as expected.

## Implementation Plan

1. Analyze current server structure
   - Review existing API endpoints in src/server/index.ts
   - Understand routing patterns and response formats
   - Check how tasks are currently loaded and updated

2. Implement GET /sequences endpoint
   - Load all tasks using existing filesystem operations
   - Use computeSequences function from task-213
   - Return JSON with sequence numbers and task data
   - Include error handling for edge cases

3. Implement POST /sequences/move endpoint
   - Accept task ID and target sequence number
   - Calculate required dependency changes
   - Update task dependencies to move to target sequence
   - Persist changes to markdown files
   - Return updated sequences or error response

4. Add input validation
   - Validate task ID exists
   - Validate target sequence is valid
   - Handle circular dependency prevention
   - Return appropriate HTTP status codes

5. Create comprehensive tests
   - Unit tests for both endpoints
   - Test edge cases (empty sequences, invalid IDs)
   - Test dependency update logic
   - Test file persistence

## Implementation Notes

### What was implemented:

1. **GET /api/sequences endpoint**
   - Added to `src/server/index.ts` in the handleRequest method
   - Loads all tasks using Core filesystem operations
   - Uses computeSequences function to calculate sequences
   - Returns JSON with full task data for each sequence
   - Handles errors gracefully with 500 status

2. **POST /api/sequences/move endpoint**
   - Added to `src/server/index.ts` in the handleRequest method
   - Accepts taskId and targetSequence in request body
   - Validates input parameters (missing fields return 400)
   - Checks if task exists (returns 404 if not found)
   - Validates target sequence number is within valid range
   - Calculates new dependencies based on target sequence:
     - Sequence 1: no dependencies
     - Sequence N: depends on all tasks in sequence N-1 (excluding self)
   - Implements circular dependency detection using DFS algorithm
   - Updates task with new dependencies and saves to filesystem
   - Returns updated task and all sequences in response

3. **Input validation and error handling**
   - Missing required fields: 400 Bad Request
   - Task not found: 404 Not Found
   - Invalid target sequence: 400 Bad Request with descriptive message
   - Circular dependencies: 400 Bad Request
   - Server errors: 500 Internal Server Error

4. **Comprehensive test suite**
   - Created `src/server/sequences.test.ts` with 13 tests
   - Tests empty sequences, single sequence, multiple sequences
   - Tests task data inclusion in responses
   - Tests all error cases (missing params, invalid IDs, etc.)
   - Tests dependency updates and circular dependency prevention
   - Tests moving tasks between sequences
   - All tests passing

### Key implementation decisions:
- Endpoints are handled in handleRequest method rather than Bun routes object for compatibility
- Used dynamic imports for computeSequences to avoid circular dependencies
- Excluded self-dependencies when calculating new dependencies for moved tasks
- Used existing Core filesystem operations for persistence
- Tests use proper task file naming format: "task-ID - Title.md"
