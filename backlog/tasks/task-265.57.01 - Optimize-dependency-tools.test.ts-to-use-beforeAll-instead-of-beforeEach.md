---
id: task-265.57.01
title: Optimize dependency-tools.test.ts to use beforeAll instead of beforeEach
status: To Do
assignee: []
created_date: '2025-09-24 15:09'
labels:
  - performance
  - testing
  - mcp
dependencies: []
parent_task_id: task-265.57
priority: high
---

## Description

Refactor dependency-tools.test.ts to use beforeAll for expensive setup operations. Currently creates new McpServer and 3 test tasks for EVERY test (20 times), causing 41.7s runtime.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test runtime reduced from 41.7s to under 10s
- [ ] #2 All 20 tests still pass
- [ ] #3 Tests remain isolated (no cross-test pollution)
- [ ] #4 Server instance reused within describe blocks
<!-- AC:END -->

## Implementation Plan

1. Move McpServer creation to beforeAll
2. Create test tasks once per describe block
3. Reset task state between tests where needed
4. Verify test isolation is maintained
