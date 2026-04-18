---
id: BACK-412
title: Add touched-files field to tasks and filename-based search
status: To Do
assignee:
  - '@codex'
created_date: '2026-04-13 16:02'
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
- [ ] #1 Tasks include a dedicated field for touched or modified files.
- [ ] #2 Users can query by filename and get all matching tasks.
- [ ] #3 Documentation or instructions describe how to set and use the touched-files field.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
