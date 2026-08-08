---
id: BACK-607
title: Resolve bare numeric task IDs consistently across all commands
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 246000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With a non-default ID prefix configured, backlog task 597 resolves the task but backlog task edit 597 fails, because ID resolution is duplicated across command paths instead of shared. Approved direction from Alex (2026-08-08): route every command that accepts a task ID through the same resolution path so bare numeric IDs behave identically everywhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task edit accepts bare numeric IDs wherever task view does, including with a custom ID prefix
- [ ] #2 All ID-accepting commands share a single resolution path
- [ ] #3 Tests with a custom prefix cover view, edit, and the other ID-accepting commands
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
