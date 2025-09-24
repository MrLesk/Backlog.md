---
id: task-265.57.05
title: Remove unnecessary git operations from MCP tests
status: To Do
assignee: []
created_date: '2025-09-24 15:09'
labels:
  - performance
  - testing
  - mcp
dependencies: []
parent_task_id: task-265.57
priority: medium
---

## Description

Many MCP tests run 'git init' but don't actually need git functionality. Remove or mock git operations in tests that don't specifically test git-related features.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Git init removed from tests that don't need it
- [ ] #2 Git operations mocked where appropriate
- [ ] #3 All affected tests still pass
- [ ] #4 Document which tests actually need git
<!-- AC:END -->

## Implementation Plan

1. Audit which tests actually need git functionality
2. Remove git init from unnecessary tests
3. Create mock git utilities for tests that check git state
4. Update test documentation

## Implementation Notes

11 out of 19 test files currently run git init in beforeEach
