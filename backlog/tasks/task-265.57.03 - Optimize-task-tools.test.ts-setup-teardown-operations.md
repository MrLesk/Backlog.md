---
id: task-265.57.03
title: Optimize task-tools.test.ts setup/teardown operations
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

Refactor task-tools.test.ts to reduce redundant setup. Currently runs git init and McpServer initialization for all 32 tests with 7 nested beforeEach blocks, taking 18.7s.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test runtime reduced from 18.7s to under 5s
- [ ] #2 All 32 tests still pass
- [ ] #3 Git operations minimized or mocked
- [ ] #4 Nested beforeEach blocks consolidated
<!-- AC:END -->

## Implementation Plan

1. Consolidate 7 nested beforeEach blocks
2. Move git init to beforeAll where possible
3. Share McpServer instance within describe blocks
4. Consider mocking git operations entirely
