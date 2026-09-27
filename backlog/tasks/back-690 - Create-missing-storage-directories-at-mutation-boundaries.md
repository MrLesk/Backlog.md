---
id: BACK-690
title: Create missing storage directories at mutation boundaries
status: Done
assignee:
  - '@codex-storage'
created_date: '2026-09-27 20:41'
updated_date: '2026-09-27 21:48'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1029'
modified_files:
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/test/cli-missing-storage-directories.test.ts
priority: high
type: bug
ordinal: 320000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A normal Git clone omits empty directories. Several supported create and move commands then fail because their destination is scanned or used before it exists. Restore consistent behavior at the existing storage mutation boundaries without requiring users to rerun initialization or an unrelated read command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creating a draft or decision succeeds when its storage directory is absent.
- [x] #2 Demoting a task, archiving a task, and completing a task succeed when their destination directories are absent.
- [x] #3 Existing ambiguity checks, duplicate-file handling, and mutation semantics are preserved.
- [x] #4 Focused regression tests cover the affected workflows from a clone-like state with missing empty directories.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce draft creation, decision creation, demotion, archive, and completion failures in isolated clone-like fixtures with missing empty destination directories.
2. Move the existing directory creation in saveDraft and saveDecision ahead of their scans. Create parent directories inside the existing Core archive and complete mutation blocks, keeping the already resolved source paths and cleanup behavior.
3. Add focused CLI regression tests for the five affected workflows. Run the nearby filesystem, draft identity, task identity, and dependency-cleanup tests.
4. Run TypeScript and the existing Biome checks, inspect the diff, and make a subtraction pass. Leave this task In Progress for coordinator architecture review and Alex’s final decision.

5. After the accepted architecture review, record the proven acceptance criteria and Definition of Done, mark the task Done on the board, and commit and push its four files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced all five scoped CLI flows failing from isolated fixtures without drafts, decisions, completed, and archive directories. Moved the two existing save-directory calls before scans and added destination mkdir calls inside the current Core archive/complete move blocks. Initial focused run now passes the five requested flows, including content preservation and dependency cleanup. Source identity resolution and cleanup ordering are unchanged. Production changes add no helper or public surface.

Verification: the focused command bun test --timeout=10000 src/test/cli-missing-storage-directories.test.ts src/test/filesystem.test.ts src/test/cli-draft-edit.test.ts src/test/local-task-command-performance.test.ts src/test/content-identity.test.ts src/test/vacated-task-references.test.ts src/test/task-path.test.ts src/test/cli-task-state.test.ts passed (189 pass, 1 existing interactive skip, 0 fail; 726 assertions). All five new CLI regressions failed before the production fix and pass after it. bunx tsc --noEmit passed. bun run check . passed (432 files, no fixes). Diff and subtraction review completed: no new abstraction or exported helper, no read-path changes, and no change to pre-resolved task identity, duplicate-file cleanup, or dependency cleanup semantics. Awaiting coordinator architecture review and Alex’s final decision; acceptance criteria and final status remain untouched.

Full-conversation architecture review found no blockers and no advisory changes. It recommends keeping the implementation as written: directory creation stays immediately before the existing scan/write or resolved-path move, without a new helper or identity lookup. Review acceptance is pending Alex; the task remains In Progress and uncommitted.

Alex accepted the architecture review and authorized finalization, commit, and push. Acceptance evidence: AC1 is proved by the draft and decision CLI regressions; AC2 by the demote, archive, and complete CLI regressions; AC3 by the passing filesystem, CLI draft identity, task path, content identity, local mutation identity, and vacated-reference tests; AC4 by all five regressions failing before the fix and passing after it in fixtures that remove empty storage directories. The source is unchanged from the recorded 189-pass scoped run and passing TypeScript/Biome checks, so those results remain current.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Draft and decision saves now create their directories before scanning. Task archive and completion create their destination before moving the already resolved source file. Five CLI regressions cover missing-directory creation and moves, content preservation, and dependency handling. Verified with 189 passing scoped tests (1 existing interactive skip), TypeScript, and Biome. Full-context architecture review accepted without changes.
<!-- SECTION:FINAL_SUMMARY:END -->
