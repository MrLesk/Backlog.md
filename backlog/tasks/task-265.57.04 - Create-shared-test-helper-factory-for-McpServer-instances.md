---
id: task-265.57.04
title: Create shared test helper factory for McpServer instances
status: To Do
assignee: []
created_date: '2025-09-24 15:09'
labels:
  - performance
  - testing
  - mcp
  - refactoring
dependencies: []
parent_task_id: task-265.57
priority: medium
---

## Description

Create a centralized test helper that provides pre-configured McpServer instances and common test fixtures to eliminate redundant setup across all 15 test files.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test helper factory created in test-utils
- [ ] #2 Factory provides cached server instances
- [ ] #3 Common fixtures (tasks, config) available
- [ ] #4 At least 5 test files migrated to use factory
<!-- AC:END -->

## Implementation Plan

1. Create McpServerTestFactory in test-utils
2. Implement server instance caching/pooling
3. Add common fixture creation methods
4. Migrate high-impact test files to use factory
