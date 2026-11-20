---
id: BACK-813
title: Document how task title edits affect filenames
status: Done
assignee:
  - '@codex'
created_date: '2026-11-20T20:51:00Z'
updated_date: '2026-11-20T21:12:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1186
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/guidelines/agent-guidelines.md
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
type: docs
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The filename examples imply that changing a task title changes its path. People browsing Markdown and scripts that rebuild the path from the current title can look for the wrong file. A stable filename lets Backlog.md recognize a tracked task across Git branches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLI reference and shipped task edit help explain that a title edit changes the title in Markdown and keeps the existing task filename.
- [x] #2 People and scripts can find the current title and actual file path by task ID, and the filename examples show how a new file is named.
- [x] #3 Agent-facing edit guidance describes the filename behavior accurately for tasks and drafts.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Correct the filename examples and show how task view returns the current title and path.
2. Describe the existing behavior in CLI help and the MCP task edit schema.
3. Verify task and draft edits in a temporary Git project, check the shipped help and tool schema, and run the related tests, type checker and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced on 3f9571d7 with a tracked TASK-1 on main and a feature branch. After a title edit on the feature branch, the browser task endpoint returned 200 and the new title. After moving the file to match that title on the feature branch, the browser returned 409 (ambiguous task ID) from either branch, and doctor listed the different paths. CLI task view continued to work because its scope is the current working copy. The issue also allows documenting the existing filename rule. Scripts can read the actual path and current title from task view JSON.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented that a title edit updates the title in Markdown and keeps the task filename. The CLI reference and agent guide show how to find the current title and path by ID. Task edit help and the MCP tool schema describe the behavior, including the different rule for drafts. Verified task and draft edits in a temporary Git project with a custom prefix and padded IDs, read the CLI help and the live MCP schema, and checked the browser on two Git branches. Type checking, Biome, 99 focused tests and two browser collision tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->
