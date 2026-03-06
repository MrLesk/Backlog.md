---
id: BACK-401
title: 'Add dueDate support for tasks and milestones across CLI, TUI, Web, and MCP'
status: To Do
assignee:
  - '@codex'
created_date: '2026-03-01 20:56'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/551'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce optional dueDate for tasks and milestones and expose it consistently across all user surfaces. Keep the field name strictly as dueDate (no deadline alias). Date parsing/storage/display semantics should follow the existing createdDate behavior already used in the project.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tasks support optional dueDate end-to-end: types, create/edit flows, markdown frontmatter persistence, and load/save parsing.
- [ ] #2 Milestones support optional dueDate end-to-end: types, milestone file persistence/parsing, and list/create/update flows where applicable.
- [ ] #3 CLI plain and interactive task surfaces include dueDate where task details/listing are shown, and task create/edit accepts dueDate input.
- [ ] #4 Web UI and server API support dueDate for tasks and milestones in create/edit/list/view paths.
- [ ] #5 MCP task and milestone schemas/handlers support dueDate only (no deadline alias) and return it in task/milestone outputs.
- [ ] #6 Automated tests cover dueDate parsing/serialization and at least one path each for CLI, web/server, and MCP.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
