---
id: BACK-563
title: Scope autoCommit to exactly the files each write touches
status: Done
assignee:
  - '@alexs-agent'
created_date: '2026-08-02 16:16'
updated_date: '2026-08-02 17:48'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/795'
  - 'https://github.com/MrLesk/Backlog.md/pull/796'
modified_files:
  - src/agent-instructions.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/file-system/operations.ts
  - src/git/operations.ts
  - src/test/agent-instructions.test.ts
  - src/test/auto-commit.test.ts
  - src/test/content-store.test.ts
  - src/test/core-autocommit-scope.test.ts
  - src/test/core.test.ts
  - src/test/decision-autocommit.test.ts
  - src/test/draft-lifecycle-autocommit-scope.test.ts
  - src/test/filesystem.test.ts
  - src/test/mcp-documents.test.ts
  - src/test/symlink-backlog-root.test.ts
type: bug
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ensure every Backlog.md autoCommit stages and commits only the paths its own write created, changed, moved, or deleted. This prevents concurrent or unrelated repository state from being swept into misleading commits or discarded from the shared index.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Document, decision, task, bulk-update, archive, completion, promotion, demotion, and agent-instruction auto-commits include only the paths written by that operation
- [x] #2 Unrelated staged, unstaged, and untracked files remain unchanged and excluded from auto-commits
- [x] #3 Moved and deleted paths are committed completely, including both sides of rename-like operations
- [x] #4 Requested paths with no Git history do not abort an otherwise valid scoped auto-commit
- [x] #5 Concurrent writes to HEAD, the working tree, or the index are preserved or fail closed without stealing index ownership
- [x] #6 Focused regression tests cover scoped ownership across task, document, decision, bulk, lifecycle, and agent-instruction paths
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
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

Integration verification: focused scoped-ownership and concurrency matrix passed; typecheck, Biome, and build passed; full suite passed with 1851 tests, 5 skipped, and 0 failures. Mutation checks confirmed the new agent-instruction and core operation regressions fail under broad pathless commits.

Windows CI exposed a timeout-only smoke test that performed two real selected-path commits. The test now captures the demote commit dispatch event and both moved paths directly; production behavior is unchanged. It passed 20 consecutive focused runs at about 0.24 seconds, the 71-test core/lifecycle matrix, and the full 1,851-test local suite.

Addressed all three Codex review findings: GitOperations.addFiles now delegates each path to the symlink-aware addFile implementation; document saves report every removed duplicate path so auto-commit includes all deletions plus the destination; draft archival reports the actual source and destination paths while keeping archive path discovery private. Added regressions for an in-repository symlinked backlog root and duplicate normalized document IDs. Verification: Biome, TypeScript, build, 152 focused tests, and the full suite (1853 pass, 5 skip, 0 fail).

Addressed the exact-head Codex follow-up review: commitFiles now partitions selected paths by their symlink-resolved Git repository before applying the existing scoped commit algorithm, and bulk task updates aggregate the exact paths returned by each save instead of re-resolving semantic IDs. Added regressions for agent instructions spanning two repositories and a legacy task whose filename differs from its frontmatter ID. Verification: both red reproductions now pass, the broader scoped/concurrency set passed 110/110, Biome/TypeScript/build passed, and the full suite passed with 1855 tests, 5 skipped, and 0 failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #796 from exact head 9142cb86 after all seven CI jobs passed, including Windows lint/unit and compile/smoke, and the automatic Codex review completed with no blockers. Auto-commit now scopes task, document, decision, lifecycle, bulk, and agent-instruction commits to their exact written paths, preserves unrelated and concurrent Git state, handles symlink-resolved repositories and legacy task paths, and retains no-history move behavior. Local verification passed Biome, TypeScript, build, 110 focused tests, and the full suite with 1,855 passing, 5 skipped, and 0 failures.
<!-- SECTION:FINAL_SUMMARY:END -->
