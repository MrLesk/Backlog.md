---
id: BACK-347
title: Add milestone editing in Web UI
status: Done
assignee:
  - '@alex-agent'
created_date: '2025-12-17 19:29'
updated_date: '2026-04-25 20:53'
labels:
  - milestones
  - web-ui
  - enhancement
milestone: m-6
dependencies: []
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Currently milestones can only be added from the Web UI. There's no way to rename a milestone or edit its details once created. Users have to manually edit config or use CLI/MCP tools.

### What
Add milestone editing capabilities to the Milestones page:
- Add an "Edit" button/icon on each milestone card
- Allow renaming milestones (with validation for duplicates)
- When renaming, update all tasks that reference the old milestone name
- Add ability to delete/remove a milestone (with confirmation)
- When deleting, option to reassign tasks to another milestone or leave unassigned

### Related
- task-344 added MCP milestone management (list/add/rename/remove)
- Should reuse the same core logic for consistency
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Context level: L2 (server API + shared milestone mutation logic + React Web UI + tests).

Reviewed context:
- Existing Web Milestones page in `src/web/components/MilestonesPage.tsx` already supports add, search, drag/drop assignment, and archive-only card action.
- Existing Web API in `src/server/index.ts` exposes milestone list/get/create/archive but not rename/remove.
- Existing MCP milestone implementation in `src/mcp/tools/milestones/handlers.ts` has the canonical rename/remove behavior: duplicate alias validation, task milestone updates, clear/reassign/keep handling, rollback, and auto-commit support.
- Existing API client methods live in `src/web/lib/api.ts`; milestone tests live under `src/test/*web-milestones*` and server milestone API coverage is currently in `src/test/server-search-endpoint.test.ts`.

Implementation plan:
1. Reuse the existing MCP milestone mutation handler from the Web server by relaxing its constructor dependency from `McpServer` to the shared `Core` type, so MCP and Web routes use the same rename/remove behavior.
2. Add Web API routes: `PUT /api/milestones/:id` for rename/update and `DELETE /api/milestones/:id` for removal with `taskHandling=clear|reassign|keep` and optional `reassignTo`; return JSON errors with 400/404/500 based on the shared handler error code.
3. Add API client methods for updating and removing milestones.
4. Update `MilestonesPage` with an Edit action/modal and a Remove confirmation modal. Rename validates empty/duplicate names before submit and server remains authoritative; remove lets users clear task milestones or reassign to another active milestone.
5. Add focused server and Web component tests for rename/remove flows and UI affordances.
6. Run targeted tests and type/check commands as appropriate, then simplify after implementation if anything duplicated remains.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation as @codex. Initial scope: add milestone edit/delete support in the Web UI, reusing existing core milestone logic where possible.

Implemented milestone rename/remove in the Web UI using the existing MCP milestone mutation handler so duplicate validation, local task updates, clear/reassign semantics, rollback, and auto-commit behavior stay consistent. Added a regression test ensuring milestone rename commit failures are not masked by rollback rename failures. Validation passed for targeted Web/server/MCP tests, task-scoped Biome checks, and `bunx tsc --noEmit`. Full `bun run check .` still reports unrelated dirty-worktree formatting for `.codex/hooks.json` and `package.json`.

Review follow-up completed: milestone mutation request parsing now treats an empty body as optional/default input but returns `VALIDATION_ERROR` for malformed JSON and non-object JSON bodies. Added Web API regression coverage for malformed DELETE bodies, non-object DELETE payloads, PUT not-found, and DELETE not-found. Removed the machine-local `.codex/hooks.json` from the worktree, ignored it via `.codex/.gitignore`, formatted `package.json`, and verified `bun run check .` now passes.

PR #604 merge-readiness pass: rebased the branch onto current origin/main, kept the newer package dependency set, restored the separate Web UI milestone Archive action while keeping Remove, fixed the Web API title-alias rename response to return the renamed milestone, and added Web component submit-path tests for edit/remove API calls plus refresh behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Web UI milestone editing/removal for BACK-347.

Changes:
- Added `PUT /api/milestones/:id` and `DELETE /api/milestones/:id` Web API routes backed by the existing MCP milestone handler, so rename/remove behavior reuses the canonical duplicate validation, task updates, clear/reassign handling, rollback, and auto-commit paths.
- Added request-body validation for milestone mutation routes: empty bodies remain optional, malformed JSON and non-object JSON now return `VALIDATION_ERROR` instead of falling through to destructive defaults.
- Added API client methods for milestone update/remove.
- Updated the Milestones page with card-level Edit and Remove actions, an edit modal for renaming, and a remove confirmation modal that can leave tasks unassigned or reassign them to another milestone.
- Added server/API tests for rename/remove behavior, malformed/non-object DELETE bodies, PUT/DELETE not-found responses, Web component tests for the new controls/modals, and a rollback regression test for milestone rename auto-commit failure handling.
- Removed the machine-local `.codex/hooks.json` from the worktree by ignoring it in `.codex/.gitignore` and formatted `package.json`.

Validation:
- `bun test src/test/server-search-endpoint.test.ts src/test/mcp-milestones.test.ts src/test/web-milestones-page-search.test.tsx`
- `bunx tsc --noEmit`
- `bun run check .`

Merge-readiness follow-up on PR #604:
- Rebased onto current main and preserved the newer dependency/package bump state.
- Restored the separate Web UI Archive action so adding Remove no longer removes existing archive behavior.
- Fixed `PUT /api/milestones/:id` to return the renamed milestone when the route parameter is a title alias instead of the canonical milestone ID.
- Added regression coverage for title-alias Web API renames and Web component edit/remove submit wiring.
<!-- SECTION:FINAL_SUMMARY:END -->
