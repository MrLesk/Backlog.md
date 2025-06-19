---
id: task-92
title: 'CI: Fix intermittent Windows test failures'
status: To Do
assignee: []
created_date: '2025-06-19'
updated_date: '2025-06-19'
labels: []
dependencies: []
---

## Description

Tests intermittently fail on Windows CI. Suspect parallel execution causing interference.

## Acceptance Criteria

- [ ] Windows tests run sequentially; All tests pass reliably

## Implementation Plan

1. Investigate which tests fail and why
2. Configure CI workflow to run tests sequentially on Windows VM
3. Ensure no cross-test interference
4. Verify by running tests repeatedly
5. Document changes
