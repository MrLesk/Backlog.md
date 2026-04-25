---
id: BACK-412
title: Add touched-files field to tasks and filename-based search
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-13 16:02'
updated_date: '2026-04-25 15:42'
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
Implemented `modifiedFiles` storage and search across task parsing/serialization, Core create/edit, CLI/server/MCP inputs, shared search indexes, plain/TUI display, and shipped guidance. Verification: focused feature tests passed; full `bun test` passed; `bunx tsc --noEmit` passed; touched source/docs passed `bunx biome check ...`. Repo-wide `bun run check .` is still blocked by an untouched pre-existing `package.json` formatting issue, so DoD item #2 remains unchecked.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
