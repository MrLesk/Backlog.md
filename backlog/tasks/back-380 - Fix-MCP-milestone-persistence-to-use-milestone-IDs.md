---
id: BACK-380
title: Fix MCP milestone persistence to use milestone IDs
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-11 20:01'
updated_date: '2026-02-11 20:25'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/514'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #514 reports that MCP `task_create`/`task_edit` store milestone titles instead of milestone IDs, causing browser milestone grouping to show tasks as unassigned. Align MCP milestone persistence with browser/CLI expectations by persisting canonical milestone IDs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `task_create` with a milestone title stores the matching milestone ID in task frontmatter.
- [x] #2 `task_edit` with a milestone title stores the matching milestone ID in task frontmatter.
- [x] #3 Regression tests cover milestone normalization for both create and edit MCP flows and pass.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Locate MCP task create/edit flow and identify where milestone values are parsed and persisted.
2. Reuse existing milestone-store resolution patterns (or add one shared helper in the MCP path) to normalize incoming milestone values to canonical milestone IDs before persistence.
3. Ensure behavior remains compatible when the input is already an ID and when a title cannot be resolved (preserve current validation/error semantics).
4. Add regression tests for both `task_create` and `task_edit` MCP flows covering title input and ID input.
5. Run focused tests and any required lint/type checks, then update acceptance criteria and notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shared milestone normalization in MCP utils and applied it to task_create/task_edit so known milestone titles persist as canonical IDs.

Updated milestone_rename/milestone_remove alias matching to handle ID/title inputs consistently across active and archived milestones while avoiding ID/title collision regressions.

Added regression coverage in `src/test/mcp-milestones.test.ts` for title->ID normalization (create/edit), archived-title resolution, ID-based rename/remove, ID-vs-title collisions, reused active+archived title behavior, and unconfigured milestone passthrough.

Validation: `bun test src/test/mcp-milestones.test.ts src/test/mcp-tasks.test.ts`, `bun run check .`, `bunx tsc --noEmit` all pass.

Ran required two-subagent review cycles and fixed all reported issues; final gate reviews from both agents returned no findings.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
