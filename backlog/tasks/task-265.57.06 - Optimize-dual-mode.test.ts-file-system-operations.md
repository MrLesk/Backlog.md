---
id: task-265.57.06
title: Optimize dual-mode.test.ts file system operations
status: To Do
assignee: []
created_date: '2025-09-24 15:10'
labels:
  - performance
  - testing
  - mcp
dependencies: []
parent_task_id: task-265.57
priority: low
---

## Description

Reduce file system overhead in dual-mode.test.ts by batching operations and using in-memory alternatives where possible. Currently takes 5.4s for 19 tests.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test runtime reduced from 5.4s to under 2s
- [ ] #2 All 19 tests still pass
- [ ] #3 File operations batched or mocked
- [ ] #4 Module re-imports optimized
<!-- AC:END -->

## Implementation Plan

1. Batch multiple file writes into single operations
2. Use in-memory file system mock where possible
3. Cache module imports instead of re-importing
4. Optimize mkdirSync calls
