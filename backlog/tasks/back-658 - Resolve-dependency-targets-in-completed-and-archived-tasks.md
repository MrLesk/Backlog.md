---
id: BACK-658
title: Resolve dependency targets in completed and archived tasks
status: To Do
assignee: []
created_date: '2026-08-30 15:23'
labels:
  - cli
  - mcp
  - web
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/942'
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
validateDependencies (src/utils/task-builders.ts:52-84) builds its known-ID set from working-copy tasks plus drafts only, so a dependency on a task that lives in backlog/completed/ or archive is refused at write time — even though Done is the normal end state of a predecessor. Combined with the replace-only semantics of --depends-on, a task whose dependency completed can no longer have its dependency list edited at all (GitHub issue #942). Fix: dependency validation resolves targets across working-copy tasks, drafts, completed, and archived records via the shared identity rules; readiness/graph semantics for such targets stay as already defined.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A dependency on a task in completed/ or archive is accepted at create and edit time on CLI, MCP, and web
- [ ] #2 Editing the dependency list of a task whose predecessors are Done works
- [ ] #3 Unknown IDs are still rejected; ambiguous identities still fail closed
- [ ] #4 Tests cover completed, archived, draft, unknown, and ambiguous targets
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
