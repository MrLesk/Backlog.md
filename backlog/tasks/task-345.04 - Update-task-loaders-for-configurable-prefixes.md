---
id: task-345.04
title: Update task loaders for configurable prefixes
status: To Do
assignee: []
created_date: '2026-01-03 20:43'
labels:
  - enhancement
  - refactor
  - task-loader
dependencies:
  - task-345.01
parent_task_id: task-345
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Overview
Update task loaders (remote, local branch, cross-branch) to use configurable prefix patterns.

### Key Files
- `src/core/task-loader.ts` - findTaskInRemoteBranches, findTaskInLocalBranches, loadRemoteTasks, buildRemoteTaskIndex, buildLocalBranchTaskIndex
- `src/core/cross-branch-tasks.ts` - Various regex patterns

### Implementation
1. Replace hardcoded `task-(\d+)` regex with `buildIdRegex(prefix)`
2. Update `findTaskInRemoteBranches()` to use prefix config
3. Update `findTaskInLocalBranches()` to use prefix config
4. Update `loadRemoteTasks()` to use prefix config
5. Update `buildRemoteTaskIndex()` to use prefix config
6. Update `buildLocalBranchTaskIndex()` to use prefix config
7. Update cross-branch task filename matching

### Tests (in same PR)
- Test remote task loading with custom prefix
- Test local branch task discovery with custom prefix
- Test cross-branch operations
- Verify existing tests still pass (backward compat)

### Docs (in same PR)
- Document how prefix affects cross-branch task discovery
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 findTaskInRemoteBranches uses configured prefix
- [ ] #2 findTaskInLocalBranches uses configured prefix
- [ ] #3 loadRemoteTasks extracts IDs using configured prefix
- [ ] #4 buildRemoteTaskIndex uses configured prefix pattern
- [ ] #5 buildLocalBranchTaskIndex uses configured prefix pattern
- [ ] #6 Cross-branch task matching uses configured prefix
- [ ] #7 Tests verify task loading with custom prefixes
<!-- AC:END -->
