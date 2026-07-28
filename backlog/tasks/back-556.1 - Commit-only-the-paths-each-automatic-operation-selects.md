---
id: BACK-556.1
title: Commit only the paths each automatic operation selects
status: To Do
assignee: []
created_date: '2026-07-28 14:46'
updated_date: '2026-07-28 15:08'
labels:
  - git
dependencies: []
parent_task_id: BACK-556
priority: high
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several production automatic-commit paths stage a whole directory or a file move and then call broad `commitChanges()`. Unrelated entries already present in the real index are therefore swept into a Backlog commit, so an automatic commit can contain files the user never intended to commit.

Convert every production automatic-commit path to the selected-path commit pipeline, so each automatic commit contains exactly the paths the operation touched. Known broad callers include promote/demote, bulk reorder/update, archive/complete, draft lifecycle, documents, decisions, and agent-instruction updates. Archive and milestone rename additionally move files, so the full set of source and target paths belongs in the commit.

Pre-existing unrelated staged and unstaged paths, plus unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, must remain outside the automatic commit and retain their prior real-index and worktree state. Post-commit hooks run against the real index and worktree, so mutations they make there persist according to normal Git semantics rather than being rolled back as temporary-index leakage.

This is a correctness fix that stands on its own under the current default automatic-commit behavior; it does not depend on any amend support. It is also a prerequisite for BACK-556, because a commit can only be marked Backlog-owned if Backlog controls exactly what it contains.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every production automatic-commit path commits only the files selected for that operation, covering tasks, drafts, bulk updates and reorders, lifecycle moves, milestones, documents, decisions, and agent-instruction updates.
- [ ] #2 Pre-existing unrelated staged and unstaged paths, and unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, remain outside the commit and retain their prior real-index and worktree state; mutations made by post-commit hooks against the real index and worktree persist according to normal Git semantics.
- [ ] #3 Operations that move files, such as archive and milestone rename, commit the complete set of source and target paths the operation touched, with no stray additions.
- [ ] #4 Existing selected-path robustness is preserved: temporary-index isolation, owned-index reconciliation, retries, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates.
- [ ] #5 Merge, rebase, cherry-pick, and revert in-progress guards continue to fail closed without moving HEAD, corrupting operation metadata, or consuming unrelated index entries.
- [ ] #6 Tests cover unrelated index and worktree state, pre-commit and commit-message hook staging isolation, post-commit real-index mutations, file-move operations, custom backlog roots, linked worktrees, and projects without Git.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
