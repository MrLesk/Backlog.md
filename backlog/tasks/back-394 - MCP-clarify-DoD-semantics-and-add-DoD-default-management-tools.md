---
id: BACK-394
title: 'MCP: clarify DoD semantics and add DoD-default management tools'
status: Done
assignee:
  - '@codex'
created_date: '2026-02-21 21:39'
updated_date: '2026-02-21 21:57'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents using Backlog MCP on external projects can misread task-level DoD fields as if they should recreate project-level DoD per task. Add MCP tools to manage project Definition of Done defaults, and clarify MCP task/tool guidance so task-level DoD is clearly optional and distinct from project defaults.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP exposes tooling to view and modify project Definition of Done defaults in config without editing markdown files directly.
- [x] #2 `task_create` and `task_edit` MCP input schema descriptions explicitly distinguish task-specific DoD changes from project-level DoD defaults.
- [x] #3 MCP workflow guidance under `src/guidelines/mcp` clearly explains when to use project DoD-default tools vs per-task DoD fields.
- [x] #4 Automated tests cover the new MCP DoD-default tools and updated tool registration/listing where applicable.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a dedicated MCP DoD-default tools module (schemas, handlers, registration) for project-level Definition of Done defaults.
2. Register new tools in MCP server and update tests that assert tool lists.
3. Update `task_create` / `task_edit` MCP schema field descriptions to explicitly mark these fields as task-specific only.
4. Update `src/guidelines/mcp` overview and task-creation wording so agents distinguish project-level defaults from per-task DoD additions.
5. Run targeted MCP test suites and type checks; then simplify any redundant wording or code paths discovered during implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery summary: DoD defaults currently live in config (`definition_of_done`) and are normalized via `saveConfig`; MCP currently exposes only task-level DoD mutation fields (`definitionOfDoneAdd/Remove/Check/Uncheck`), which likely drives confusion in external agent sessions.

Working branch: tasks/back-394-mcp-dod-workflow

Follow-up clarification requested: make `task_create`/`task_edit` DoD bullets explicitly state DoD is not acceptance criteria and per-task DoD usage is exceptional.

Updated MCP guidance wording so DoD is explicitly not AC and per-task DoD usage is marked exceptional-only in `overview-tools.md`, `overview.md`, and `task-creation.md`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented MCP-level clarification and management for Definition of Done semantics.

What changed:
- Added dedicated project-level DoD default tools:
  - `definition_of_done_defaults_get`
  - `definition_of_done_defaults_upsert`
- Wired new tools into MCP server registration.
- Clarified task-level DoD semantics in MCP schemas:
  - `task_create` and `task_edit` DoD fields now explicitly describe task-specific behavior and reference project-level default management.
- Clarified workflow docs under `src/guidelines/mcp` to distinguish:
  - project-level DoD defaults (managed via new tools)
  - per-task DoD checklist operations (existing task fields)
- Added/updated tests:
  - new `src/test/mcp-definition-of-done-defaults.test.ts`
  - updated `src/test/mcp-server.test.ts`
  - updated `src/test/mcp-tasks.test.ts`

Validation run:
- `bun test src/test/mcp-server.test.ts src/test/mcp-tasks.test.ts src/test/mcp-definition-of-done-defaults.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`

Additional cleanup:
- Fixed existing TypeScript compile blocker in `src/web/components/MilestonesPage.tsx` by removing a duplicate local `isDoneStatus` declaration that conflicted with imported utility.

Follow-up clarification applied: task-level DoD bullets now explicitly state DoD is not acceptance criteria and per-task DoD customization should be exceptional.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
