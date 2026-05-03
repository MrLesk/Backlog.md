---
id: BACK-409
title: Clarify acceptance criteria format in task creation guide
status: Done
assignee:
  - '@codex'
created_date: '2026-03-26 13:48'
updated_date: '2026-05-03 11:40'
labels:
  - bug
  - docs
  - mcp
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/582'
  - 'https://github.com/MrLesk/Backlog.md/pull/583'
modified_files:
  - src/guidelines/mcp/task-creation.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The MCP task creation guide describes acceptance criteria conceptually but does not specify the expected `task_create.acceptanceCriteria` parameter shape. Clarify that `acceptanceCriteria` expects an array of strings so agents do not pass a scalar string and trigger validation errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The task creation guide specifies that `acceptanceCriteria` is an array of strings.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update `src/guidelines/mcp/task-creation.md` so the acceptance criteria guidance names the expected array-of-strings shape.
2. Keep the surrounding guidance on atomic, testable criteria unchanged.
3. Validate formatting/checks for the documentation-only change.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Documentation change is reflected in the MCP task creation guide.
- [x] #2 `bun run check .` passes.
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated `src/guidelines/mcp/task-creation.md` to clarify that the `acceptanceCriteria` field is an array of strings while preserving the existing guidance that each item should be specific, testable, and independent.
<!-- SECTION:FINAL_SUMMARY:END -->
