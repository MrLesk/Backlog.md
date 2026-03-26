---
id: BACK-409
title: clarify acceptance criteria format in task creation guide
status: Done
assignee: []
created_date: '2026-03-26 13:48'
updated_date: '2026-03-26 13:51'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task creation guide described acceptance criteria vaguely. Clarify that the `acceptanceCriteria` field expects an array of strings — each item being a specific, testable, and independent condition.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Update `src/guidelines/mcp/task-creation.md` line 74: change the acceptance criteria description from "Specific, testable, and independent (the WHAT)" to "An array of strings - specific, testable, and independent items (the WHAT)" to make the expected field type explicit.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The task creation guide specifies that acceptance criteria is an array of strings
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated `src/guidelines/mcp/task-creation.md` to clarify that the `acceptanceCriteria` field is an array of strings. Change: \"Specific, testable, and independent (the WHAT)\" → \"An array of strings - specific, testable, and independent items (the WHAT)\"."
<!-- SECTION:FINAL_SUMMARY:END -->
