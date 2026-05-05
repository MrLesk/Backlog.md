---
id: BACK-466
title: Fix task list milestone filtering
status: Done
assignee:
  - '@abbyssoul'
created_date: '2026-05-05 01:12'
updated_date: '2026-05-05 01:13'
labels:
  - bug
  - milestone
  - cli
  - mcp
dependencies: []
references:
  - handover-task-list-milestone-filter-bug.md
modified_files:
  - src/core/backlog.ts
  - src/mcp/tools/tasks/index.ts
  - src/test/cli-milestone-filter.test.ts
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task list filter should return tasks assigned to a requested milestone, including tasks stored with scalar milestone frontmatter as described in the handover reproducer, instead of returning an empty result set.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI task list filtering returns tasks whose scalar milestone field matches the requested milestone.
- [x] #2 MCP task_list filtering resolves milestone IDs and titles consistently with the rest of the milestone model.
- [x] #3 Regression coverage proves valid milestone assignments are not filtered out.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce milestone filtering against scalar task milestone values. 2. Route task-list filtering through the canonical milestone resolver. 3. Add regression coverage for CLI/MCP-visible behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented milestone filter resolution so task list results include tasks assigned with scalar milestone frontmatter.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed task-list milestone filtering so valid milestone assignments are returned instead of empty results. The filter path now resolves milestone values consistently with the milestone model, and regression coverage protects the scalar milestone frontmatter case described in the handover.
<!-- SECTION:FINAL_SUMMARY:END -->
