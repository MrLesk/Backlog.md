---
id: BACK-757
title: Remove cross-branch loading code that nothing calls
status: To Do
assignee: []
created_date: '2026-10-11 20:02'
updated_date: '2026-10-11 20:36'
labels: []
dependencies:
  - BACK-719
references:
  - src/core/cross-branch-tasks.ts
  - src/git/operations.ts
  - src/ui/view-switcher.ts
priority: low
type: chore
ordinal: 375000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several pieces of the cross-branch loading code have no production caller, and one of them still costs time at run time. `getLatestTaskStatesForIds` and `filterTasksByLatestState` in `src/core/cross-branch-tasks.ts` are an older implementation of branch state resolution that only tests import. `listRemoteBranches`, `listRecentRemoteBranches`, `listLocalBranches` and `getFileLastModifiedBranch` in `src/git/operations.ts` appear to be reachable only from tests or through an option that no caller sets. The filter block inside `FileSystem.listTasks` appears to have no caller that passes a filter, and the status filter in `ContentStore.getTasks` duplicates the shared task filter. In the terminal UI, `BackgroundLoader` in `src/ui/view-switcher.ts` starts a full cross-branch load, including a remote fetch, from the task list view, and no code appears to read its result. This list comes from reading the code on 2026-10-11, so each item needs confirming before it is removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each listed item is either removed or kept with a recorded reason that names its production caller.
- [ ] #2 The terminal task list no longer starts a cross-branch load or a remote fetch whose result is unused.
- [ ] #3 Apart from the previous point, no CLI, MCP, web or TUI output changes.
- [ ] #4 Tests that exercised only removed code are removed, and no other test needs changing to pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
