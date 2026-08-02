---
id: BACK-563
title: Scope autoCommit to exactly the files each write touches
status: In Progress
assignee:
  - '@alexs-agent'
created_date: '2026-08-02 16:16'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/795'
  - 'https://github.com/MrLesk/Backlog.md/pull/796'
modified_files:
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/file-system/operations.ts
  - src/git/operations.ts
type: bug
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure every Backlog.md autoCommit stages and commits only the paths its own write created, changed, moved, or deleted. This prevents concurrent or unrelated repository state from being swept into misleading commits or discarded from the shared index.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document, decision, task, bulk-update, archive, completion, promotion, and demotion auto-commits include only the paths written by that operation
- [ ] #2 Unrelated staged, unstaged, and untracked files remain unchanged and excluded from auto-commits
- [ ] #3 Moved and deleted paths are committed completely, including both sides of rename-like operations
- [ ] #4 Requested paths with no Git history do not abort an otherwise valid scoped auto-commit
- [ ] #5 Concurrent writes to HEAD, the working tree, or the index are preserved or fail closed without stealing index ownership
- [ ] #6 Focused regression tests cover scoped ownership across task, document, decision, bulk, and lifecycle paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Merge current main and reconcile the contributor patch with the current temporary-index commit architecture.
2. Route every affected write through exact-path staging and scoped commits while retaining fail-closed task identity and rollback behavior.
3. Exercise unrelated staged, unstaged, and untracked state; moves/deletes; no-history paths; non-ASCII paths; and concurrent index/HEAD ownership.
4. Run focused autoCommit tests, typecheck, Biome, build, the full suite, and required CI before merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Issue #795 and PR #796 supplied the original reproduction and focused regression coverage. Current main already contains temporary-index and compare-and-swap HEAD ownership safeguards; the integration preserves that architecture and layers the PR scope fix onto it.
<!-- SECTION:NOTES:END -->
