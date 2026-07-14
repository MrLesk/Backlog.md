---
id: BACK-412
title: Add touched-files field to tasks and filename-based search
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-13 16:02'
updated_date: '2026-04-25 18:38'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add support for tracking which files were touched or modified as part of a task, then make that metadata searchable by filename so users can find all tasks that touched a given file.

This should cover task data model updates, persistence and indexing updates, and CLI or MCP search behavior where applicable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tasks include a dedicated field for touched or modified files.
- [x] #2 Users can query by filename and get all matching tasks.
- [x] #3 Documentation or instructions describe how to set and use the touched-files field.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a dedicated `modifiedFiles` task domain field, persisted as `modified_files` frontmatter, following the existing `references`/`documentation` array handling pattern.
2. Thread `modifiedFiles` through create/edit inputs for Core, CLI, server API, and MCP so tasks can store project-root-relative paths without direct markdown edits.
3. Extend shared task search indexing (`core/search-service.ts` and `utils/task-search.ts`) so existing CLI, Web UI, and TUI free-text search can find tasks by modified file paths without search UI changes.
4. Add a separate MCP `task_search.modifiedFiles` filter and a CLI `backlog search --modified-file` filter; matching is case-insensitive substring matching against stored paths.
5. Update shipped agent/MCP guidance to explain setting `modifiedFiles` and searching by modified file path.
6. Add focused tests for markdown persistence, shared search behavior, CLI search, MCP filtering, and server search endpoint behavior, then run scoped tests plus type/check commands as needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `modifiedFiles` storage and search across task parsing/serialization, Core create/edit, CLI/server/MCP inputs, shared search indexes, plain/TUI display, and shipped guidance. Addressed Codex review feedback by ensuring `backlog search --modified-file ...` seeds the interactive unified view with the already-filtered task results instead of opening an unfiltered all-task list; no-result modified-file searches now print the empty search result instead of selecting an unrelated task.

Verification: focused modified-file/search tests passed, full bun test passed before the original PR checks, bunx tsc --noEmit passed, and bun run check . passes on the rebased current-main branch with existing optional-chain warnings only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Added `modifiedFiles` task metadata persisted as `modified_files` frontmatter and threaded it through Core, CLI, MCP, server, and web API surfaces.
- Indexed modified file paths in shared search so tasks can be found by filename/path query and filtered through CLI/MCP/server search paths.
- Updated task display and shipped guidance to document setting and searching modified files.
- Fixed interactive CLI search so `--modified-file` opens only matching tasks instead of falling back to an unfiltered all-task list.

Validation:
- bun test src/test/cli-search-command.test.ts src/test/search-service.test.ts src/test/task-search-label-filter.test.ts src/test/mcp-tasks.test.ts src/test/server-search-endpoint.test.ts
- bunx tsc --noEmit
- bun run check .
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
