---
id: BACK-467
title: Prevent priority filter test timeout
status: Done
assignee:
  - '@abbyssoul'
created_date: '2026-05-05 01:12'
updated_date: '2026-05-05 01:13'
labels:
  - test
  - performance
  - cli
dependencies: []
modified_files:
  - src/test/cli-priority-filtering.test.ts
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The case-insensitive priority filter integration test should avoid unnecessary serial CLI runtime so the suite remains reliable on slower environments.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test still verifies high, medium, and low priority filtering case-insensitively.
- [x] #2 The CLI task list checks run concurrently to reduce wall-clock runtime.
- [x] #3 The test remains stable under the Bun test runner.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Identify the serial CLI calls causing timeout risk. 2. Keep the same priority assertions while running list commands in parallel. 3. Verify the targeted test passes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the case-insensitive priority filtering test to run the three task list commands concurrently.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reduced timeout risk in the priority filtering integration test by running the high, medium, and low CLI list checks in parallel while preserving the same case-insensitive assertions.
<!-- SECTION:FINAL_SUMMARY:END -->
