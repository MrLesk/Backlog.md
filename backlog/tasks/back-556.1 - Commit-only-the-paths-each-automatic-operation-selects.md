---
id: BACK-556.1
title: Commit only the paths each automatic operation selects
status: Done
assignee:
  - '@andreas'
created_date: '2026-07-28 14:46'
updated_date: '2026-07-28 17:15'
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
- [x] #1 Every production automatic-commit path commits only the files selected for that operation, covering tasks, drafts, bulk updates and reorders, lifecycle moves, milestones, documents, decisions, and agent-instruction updates.
- [x] #2 Pre-existing unrelated staged and unstaged paths, and unrelated paths staged by pre-commit or commit-message hooks through the isolated commit index, remain outside the commit and retain their prior real-index and worktree state; mutations made by post-commit hooks against the real index and worktree persist according to normal Git semantics.
- [x] #3 Operations that move files, such as archive and milestone rename, commit the complete set of source and target paths the operation touched, with no stray additions.
- [x] #4 Existing selected-path robustness is preserved: temporary-index isolation, owned-index reconciliation, retries, current-configuration signing and signing failures, legacy and modern hook runners, and atomic expected-old-SHA branch updates.
- [x] #5 Merge, rebase, cherry-pick, and revert in-progress guards continue to fail closed without moving HEAD, corrupting operation metadata, or consuming unrelated index entries.
- [x] #6 Tests cover unrelated index and worktree state, pre-commit and commit-message hook staging isolation, post-commit real-index mutations, file-move operations, custom backlog roots, linked worktrees, and projects without Git.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one Core helper that stages an operation's deduplicated path set and delegates to the existing selected-path Git commit pipeline.
2. Convert broad automatic commit callers for bulk task updates, task/draft lifecycle moves, decisions, documents, and agent instructions to pass exact source/target/output paths; preserve milestone callers already using commitFiles.
3. Adjust internal filesystem/core return values only where an operation must report every touched source and target path, without adding external public API surface.
4. Add focused regression coverage for unrelated index/worktree state, lifecycle moves, pre/message-hook isolation, post-hook mutations, custom roots, linked worktrees, and filesystem-only projects.
5. Run scoped tests, TypeScript, Biome, then record evidence and finalize BACK-556.1 before activating BACK-556.2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one exact-path staging/commit path and converted bulk task updates, task/draft lifecycle moves, decisions, documents, and agent-instruction writes; existing milestone mutations remain on commitFiles. FileSystem decision writes now report every removed/created path, and ContentStore preserves that result.

Verification: 217 tests passed across auto-commit, core, CLI lifecycle, TUI selected-path robustness, MCP milestones, agent instructions, ContentStore, and the new selected-path suite (881 assertions). The new suite directly verifies exact source/target commits, unrelated staged and unstaged preservation, pre/message-hook isolation, post-hook real-index mutations, custom roots, linked worktrees, and no-Git projects. bunx tsc --noEmit, focused Biome, and git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Converted all production automatic mutation callers from broad repository commits to exact operation path sets, including lifecycle source/target files and renamed decisions/documents. Verified with 217 focused tests (881 assertions), TypeScript, Biome, and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
