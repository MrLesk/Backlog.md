---
id: BACK-659
title: Include grandchild subtasks in board export grouping
status: To Do
assignee: []
created_date: '2026-08-30 15:23'
labels:
  - cli
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/944'
ordinal: 291000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The markdown board export builds its children map keyed only by top-level parents (src/board.ts ~90-140), so a subtask whose parent is itself a subtask is silently dropped from the exported board (GitHub issue #944). Fix the grouping to include nested subtasks; rendering depth/shape choices should follow the existing export format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A subtask of a subtask appears in the exported board markdown
- [ ] #2 Existing flat parent/child export output is unchanged
- [ ] #3 A test pins the nested case
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
