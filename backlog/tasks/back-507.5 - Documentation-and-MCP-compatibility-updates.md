---
id: BACK-507.5
title: Documentation and MCP compatibility updates
status: Done
assignee:
  - '@codex'
created_date: '2026-06-13 14:13'
updated_date: '2026-06-13 20:39'
labels: []
milestone: m-7
dependencies: []
parent_task_id: BACK-507
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update public docs and tests so CLI instructions are documented as the recommended AI workflow while MCP remains an optional connector. Remove stale MCP-first wording where it conflicts with the current direction, while keeping the documented MCP workflow available for users who choose it.

Important cleanup: README currently references `backlog://docs/task-workflow`, while the implemented MCP resources are `backlog://workflow/overview`, `task-creation`, `task-execution`, and `task-finalization`. Documentation should point users to `backlog instructions` instead of source file paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README and CLI reference describe CLI instructions as the recommended AI integration and MCP as optional.
- [x] #2 Manual setup docs tell users to fetch guidance with `backlog instructions` instead of copying source files.
- [x] #3 Stale MCP resource references are corrected to the implemented `backlog://workflow/...` URIs.
- [x] #4 MCP tests continue to assert the existing resources/tools remain available for explicit MCP users.
- [x] #5 Docs mention that task markdown remains human-readable but should be modified through CLI/MCP/Web surfaces.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan

1. Update README getting-started and AI-agent sections to describe CLI instructions as the recommended default and MCP as optional.
2. Update CLI-INSTRUCTIONS init/reference sections to mention the new `backlog instructions` command and short agent nudge.
3. Correct stale MCP resource references to `backlog://workflow/...` and avoid pointing users at source files for setup guidance.
4. Add or adjust docs/tests only where they lock user-facing wording.
5. Run targeted docs-related tests plus TypeScript and lint/check at final verification.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated README and CLI reference docs to describe CLI instructions as the recommended AI workflow, corrected stale MCP resource references, preserved MCP workflow tests, and removed the internal version label from public code/docs and Backlog task metadata.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
