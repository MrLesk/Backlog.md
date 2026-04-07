---
id: BACK-409
title: Add GitButler Integration for Virtual Branch Support
status: To Do
assignee: []
created_date: '2026-04-07'
updated_date: '2026-04-09 13:09'
labels:
  - git-integration
dependencies: []
priority: high
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context
Backlog.md currently uses standard Git branches for task state management. GitButler is an alternative Git workflow that uses virtual branches instead of traditional Git branches. This integration enables users to work with virtual branches when GitButler mode is enabled.

## Desired Outcome
Provide native GitButler integration so users can work with virtual branches, stage changes via `but stage`, and view tasks from applied virtual branches in the board view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog config gitbutler: true` enables GitButler mode
- [x] #2 In GitButler mode, all task changes stage to virtual branches via `but stage`
- [x] #3 `backlog board` shows tasks from applied virtual branches
- [x] #4 Virtual branch tasks show `vb:branchName` indicator
- [x] #5 Error clearly if GitButler not installed but mode enabled
- [ ] #6 Modes are mutually exclusive - no Git operations when GitButler enabled
- [x] #7 Seamless switching - GitButler operations used when enabled, Git when disabled
- [x] #8 autoCommit: true with gitbutler: true uses `but commit` not `git commit`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1: Config & Types
1. Add `gitbutler` field to `BacklogConfig` interface in `src/types/index.ts`
2. Add `"virtual-branch"` to task source type (current: `source?: "local" | "remote" | "completed" | "local-branch"`)
3. Add `virtualBranch` object field to Task interface: `{ name: string; state: "applied" | "unapplied" }`
4. Update config wizard in `src/commands/advanced-config-wizard.ts`

### Phase 2: GitButler Wrapper
1. Create `src/git/gitbutler.ts` with GitButlerOperations class
2. Implement detection: check `.gitbutler/` dir + `but --version`
3. Implement branch operations: list, create, apply, unapply via `but branch`, `but apply`, `but unapply`
4. Implement file staging via `but stage` (maps to `but add` in CLI)
5. Implement commit via `but commit`
6. Create `src/utils/gitbutler-detect.ts` helper

### Phase 3: Adapter Pattern
1. Create `src/git/adapter.ts` with GitAdapter interface
2. GitAdapterImpl wrapping existing GitOperations
3. GitButlerAdapterImpl wrapping GitButlerOperations
4. Update Core class in `src/core/backlog.ts` to use adapter

### Phase 4: Task Loading
1. Add `loadVirtualBranchTasks()` to `src/core/task-loader.ts`
2. Update `queryTasks()` to include virtual branch tasks
3. Update ID generation to account for virtual branches

### Phase 5: CLI Updates
1. Add `--virtual-branch <name>` flag to task create command
2. Add `--source virtual-branch` filter to list command
3. Add validation for GitButler mode operations

### Phase 6: UI Updates
1. Update TUI board with `vb:branch` indicators
2. Update task viewer with read-only warnings for virtual branches
3. Update Web UI with virtual branch badges

### Phase 7: Testing
1. Add unit tests for GitButlerOperations
2. Add adapter tests with mock GitButler
3. Add integration tests

### Phase 8: Fix autoCommit with GitButler
1. Add GitButlerOperations to GitButlerAdapterImpl for commits
2. Ensure commit methods use `but commit` instead of `git commit`
3. Stage files use `but stage` instead of `git add`
4. Test autoCommit with gitbutler: true to verify commits go to virtual branches
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 All acceptance criteria verified manually
<!-- DOD:END -->
