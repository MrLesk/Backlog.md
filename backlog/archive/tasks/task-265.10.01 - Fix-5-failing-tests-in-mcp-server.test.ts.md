---
id: task-265.10.01
title: Fix 5 failing tests in mcp-server.test.ts
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-14 13:38'
updated_date: '2025-09-14 13:44'
labels:
  - testing
  - bugfix
  - mcp
dependencies: []
parent_task_id: task-265.10
---

## Description

Fix the existing test failures before extending coverage

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fix SSE transport test expectation (SSE is now implemented),Fix status validation tests by initializing project config with emoji statuses,Fix task update error handling to match wrapped responses,Fix task creation validation to expect wrapped error response,Fix non-existent task update to expect wrapped error response,All 27 existing tests pass
<!-- AC:END -->
