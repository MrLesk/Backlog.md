---
id: BACK-445
title: Add command filters to web search
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-26 08:19'
labels:
  - web-ui
  - search
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/338'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add field:value command filters to the browser search experience so users can narrow tasks, documents, and decisions by structured fields while preserving existing text search behavior. This replaces the outdated task-263 reference from PR #338, which conflicts with current BACK task IDs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Browser search supports field:value command filters for task fields such as status, priority, assignee, and labels.
- [ ] #2 Command filters can be combined with free-text search without breaking existing text search results.
- [ ] #3 Search behavior handles unknown or malformed command filters predictably without crashing the UI.
- [ ] #4 The PR title and task references use the current BACK task ID format.
- [ ] #5 Focused automated coverage verifies command parsing/filtering and the relevant web search behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
