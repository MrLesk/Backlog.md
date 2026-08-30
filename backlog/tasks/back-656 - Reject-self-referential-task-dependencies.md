---
id: BACK-656
title: Reject self-referential task dependencies
status: To Do
assignee: []
created_date: '2026-08-30 12:30'
labels:
  - cli
  - mcp
  - web
  - bug
dependencies: []
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A task can currently depend on itself: `backlog task edit TASK-1 --dep TASK-1` succeeds and stores the dependency (verified), after which readiness treats the task as permanently blocked by itself. Dependency validation must reject a dependency that resolves to the task being edited or created, in the single shared validation owner so CLI, MCP, and web all inherit it, including alias forms of the same identity (task-1, TASK-001). backlog doctor reports existing self-dependencies in projects that already have them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creating or editing a task with itself as a dependency fails with a clear error on CLI, MCP, and web
- [ ] #2 Alias forms of the same identity (case, zero-padding) are rejected the same way
- [ ] #3 backlog doctor reports an existing self-dependency
- [ ] #4 Tests cover direct and alias-form self-dependencies across the shared validation path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
