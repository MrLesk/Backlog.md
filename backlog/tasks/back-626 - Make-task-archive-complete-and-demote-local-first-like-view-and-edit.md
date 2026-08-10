---
id: BACK-626
title: 'Make task archive, complete, and demote local-first like view and edit'
status: To Do
assignee: []
created_date: '2026-08-10 06:10'
labels: []
dependencies: []
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the PR #898 (BACK-623) review. task archive, task complete, and task demote still resolve their target through the default cross-branch loadTaskById (src/cli.ts around the archive/complete/demote handlers), so they pay the full corpus load and attempt a remote fetch that view/edit/list no longer do, and they surface different errors for branch-only tasks (archive: 'Cannot archive task from another branch'; view: not found). Per the owner ruling that CLI task commands are local-only, align these three commands with the local active+completed resolution used by view/edit, including the fail-closed local ambiguity behavior and the branch-aware not-found hint. Not part of the v1.50.x hotfix release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 task archive, task complete, and task demote resolve targets through the shared local resolution used by task view and task edit
- [ ] #2 None of the three commands triggers a remote fetch or cross-branch corpus load (fetch-tripwire test)
- [ ] #3 Branch-only targets produce the same local not-found error and hint as task view
- [ ] #4 Local fail-closed ambiguity (AmbiguousTaskIdError) is preserved for all three commands
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
