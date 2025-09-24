---
id: task-265.57.02
title: Mock timers in connection-manager.test.ts to eliminate real delays
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

Replace real setTimeout/setInterval with Bun's mock timers. Tests currently wait for actual delays (100ms-1100ms), contributing to 4.8s total runtime.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test runtime reduced from 4.8s to under 1s
- [ ] #2 All 18 tests still pass
- [ ] #3 Mock timers properly advance time
- [ ] #4 Timeout behavior correctly tested without real delays
<!-- AC:END -->

## Implementation Plan

1. Import and setup Bun's mock timer utilities
2. Replace setTimeout/setInterval with mock versions
3. Use jest.advanceTimersByTime() to simulate time passing
4. Verify timeout behaviors still work correctly
