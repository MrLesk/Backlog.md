---
id: BACK-765
title: >-
  Commit moved linked record files as links and report a failed commit in one
  sentence
status: Done
assignee:
  - '@codex-765'
created_date: '2026-10-14 04:13'
updated_date: '2026-10-15 22:02'
labels:
  - bug
dependencies:
  - BACK-731
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1101'
  - git-operations
  - core
  - mcp-server
  - src/core/backlog.ts
  - src/mcp/errors/mcp-errors.ts
modified_files:
  - src/git/operations.ts
  - src/core/backlog.ts
  - src/mcp/errors/mcp-errors.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/linked-record-commit.test.ts
  - src/test/commit-failure-after-change.test.ts
priority: high
type: bug
ordinal: 386000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With auto-commit on, moving a record file that is a symbolic link commits the wrong thing. On `main`, `backlog task archive` of a task whose file is a link commits only the removal of the old path and leaves the archived link untracked, with exit 0. On a fresh clone the task is gone and its ID can be handed out again. The cause is the Git helper that stages a path: it resolves the last part of the path through the link and stages the unchanged target. Restore and delete in the task archive stack behave the same way.

The same moves report a commit that fails after the file was moved in different words on each interface. `backlog task delete` says "Task X was deleted, but committing the change failed", `backlog task archive` prints only the Git error, and MCP `task_archive` answers "An unexpected error occurred". Every interface must say the same thing for the same case.

This was found while reviewing BACK-761, which archives documents and needs both fixes for linked document files. It is split out so the change to Git staging can be reviewed and reverted on its own.

Scope: the rule for which path is staged, and one message for "moved, but the commit failed" for archive, restore and delete. Demote and promote keep their current commit-failure message. A record file inside a linked folder whose target is outside the repository still cannot be committed; it must keep failing loudly.

This is part of the stack for issue #1101. It builds on BACK-720 (pull request #1097), and BACK-761 builds on it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With auto-commit on, `backlog task archive`, `backlog task restore` and `backlog task delete` of a task whose file is a symbolic link commit the link itself (added at its new path, removed from its old path), for a link whose target is inside the repository and one whose target is outside. Afterwards `git status` is clean.
- [x] #2 An edit made through a committed link still commits the file the link points to, as before.
- [x] #3 A record file inside a symbolic-linked folder that leads outside the repository is still moved, and the command says that the record was moved and that committing the change failed, and exits non-zero.
- [x] #4 With auto-commit off, these commands stage nothing.
- [x] #5 When the file was moved but the commit fails, `backlog task archive`, `backlog task restore` and `backlog task delete` print `Task <id> was archived (restored, deleted), but committing the change failed: <reason>` and exit non-zero. The MCP tools `task_archive`, `task_restore` and `task_delete` return the same sentence, and the web archive route answers with it and still reports the task as moved.
- [x] #6 The rule for when a link is staged as the link and when its target is staged is written in one place in the code, including that the answer depends on the Git index and HEAD at the time of the call.
- [x] #7 Tests drive the CLI and MCP for each behavior above with task files.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Integrate exact repaired BACK-720 parent 1bf2bf0aaf1f3813352b3921d130abb2ec29c01a into the existing PR branch, preserving its original commits and the parent allocator/cleanup locking semantics.
2. Reuse ChangeNotCommittedError for actual delete staging/commit failures and retain TaskDeletionAppliedError for other failures after unlink, mapping both through the existing shared MCP runCoreOperation.
3. Update only affected error assertions and verify linked-file commits, lifecycle concurrency, commit scopes, and CLI/MCP messages.
4. Run canonical Bun 1.4.3 types, Biome 2.5.15, build and compiled smoke. Review for simplification and hold In Progress for full-context review before final proof, Done, commit or push.

5. Full-context review accepted the integration (KEEP). Finalize the verified task, commit the pending merge, push with the original remote-head lease, and return the clean shared checkout to main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split out of BACK-761 after its second review. The Git helper rule, the one error class for a failed commit after a move, and the shared MCP mapping came over unchanged in behavior; the document cases stay in BACK-761.

Staging rule (src/git/operations.ts): resolveExistingPath resolves every folder on the way and the last component too, except a file link whose own path is new or changed in Git (git status). That link is staged under its own name. An unchanged link is resolved, so an edit through it still commits the file it points to. The comment of changedFileLinkPath says that the answer depends on the Git index and HEAD at the time of the call; commitFiles makes its last lookup (restoreIndexEntriesIfMatches) before update-ref, and a comment there marks it.

Before this change (built from 8901002e): archive of a task whose file is a committed link committed only the removal of the old path and left the archived link untracked, with exit 0; restore and delete after it committed nothing. The CLI printed only the Git error for a failed archive commit, and MCP task_archive, task_restore and task_delete answered An unexpected error occurred (INTERNAL_ERROR).

After: the commit holds the link at its new path and the removal of the old one; git status is clean. Task archive, restore and delete throw ChangeNotCommittedError; the CLI prints its message, MCP returns it as OPERATION_FAILED through runCoreOperation in src/mcp/errors/mcp-errors.ts, and the web archive route returns it with archiveState moved.

Known corner: a link that is new or re-pointed and not committed yet is the path that is staged, so the first edit through it commits only the link and the edit in its target waits for the next commit. The test file pins this. Staging both the link and its target would remove the corner; it needs commitFiles to read index entries under the paths it selected, so it is left as a follow-up.

Demote and promote keep their own commit-failure message (the Git error only); they are out of scope.

Checks: bunx tsc --noEmit and bun run check . pass. One file at a time: linked-record-commit 11 pass, commit-failure-after-change 8 pass, git 20, auto-commit 11, core-autocommit-scope 4, draft-lifecycle-autocommit-scope 6, task-autocommit-index-scope 3, symlink-backlog-root 3, cli-commit-behaviour 5, archived-task-folders 23, cli-task-delete 15, cli-task-restore 10, mcp-tasks 43, vacated-task-references 25, no failures. With the base Git helper the four link tests and the corner test fail; with the old archive error the four archive commit-failure tests fail.

Integration preparation: clean checkout and both local/origin BACK-765 refs verified at 4f1a90de3a33b0cbdab839afe2f63e1dd921a44c; unrelated BACK-767 remains a017677fbb65daf954f9453b1320926d70604a25. Reopened for the repaired parent integration. Parent deletion distinguishes an actual commit failure from lock release after success; the existing shared MCP error owner will preserve both meanings.

Repaired-parent integration is stable at the review hold: exact BACK-720 parent 1bf2bf0aaf1f3813352b3921d130abb2ec29c01a merged into original HEAD 4f1a90de3a33b0cbdab839afe2f63e1dd921a44c without a commit. Parent allocator ownership, cleanup widening, canonical archive/restore locks, complete restored-state publication, and applied-deletion tracking are unchanged. Delete now uses ChangeNotCommittedError only for staging/commit failure; other post-unlink failures retain TaskDeletionAppliedError. The existing shared MCP runCoreOperation maps both to OPERATION_FAILED; the removed task-specific translator remains removed. Original cause/logging and archiveState/demotionState handling are preserved.

Validation: 274 focused tests pass with required fixture access (150 lifecycle/link/error cases, 120 Git/commit-scope/content-store cases, 4 demotion endpoint/client cases). Bun 1.4.3 check:types, Biome 2.5.15 check, build, and compiled CLI/browser/MCP smoke pass. Real Git hooks against the compiled CLI and compiled MCP prove actual commit failure leaves HEAD unchanged and reports the accepted failed-commit sentence, while a successful delete commit followed by allocator lock release failure keeps the scoped deletion commit and reports releasing deletion locks. A compiled restore regression verifies added board link, removed archive link, mode 120000, unchanged/unstaged target, and clean Git status. The source linked-file suite proves these moves through CLI and MCP for inside/outside targets.

Subtraction review: the integration adds no new lifecycle layer, lock policy, compatibility shim, or exported helper. Its production adaptation is the deletion commit-error selection and one shared MCP mapping. The existing linked-record test only needed formatting for current Biome; parent tests required no weakened assertions. No open product decisions or unresolved checks. Task stays In Progress for full-context review before finalization, commit, and push.

Final review accepted the stable integration (KEEP), with no source changes or new product decision. AC evidence: linked-record-commit tests prove AC 1-4 and 7 through CLI/MCP with inside/outside targets; commit-failure-after-change and parent applied-deletion tests prove AC 5 and 7, including the HTTP archiveState response. The shared Git path rule and before-update-ref lookup comment, together with the moved-link and edit-through-link cases, prove AC 6. The inherited DoD type-check command is superseded by the repaired parent current bun run check:types (Bun 1.4.3); canonical types, Biome 2.5.15, and all 274 focused tests pass.

The parent PR #1096 restore finding (discussion_r4288696906) is owned here once: source CLI/MCP link regressions and a compiled restore prove the board link is added and the archive link removed, mode 120000, with the target unchanged and unstaged and Git status clean. Real compiled CLI/MCP pre-commit hooks prove commit rejection leaves HEAD unchanged and reports the applied deletion plus commit failure. A successful pre-commit hook that blocks allocator lock release proves the deletion commit succeeds, scoped removal stays committed, and the reported failure is releasing deletion locks.

Inherited locking remains bounded: task then draft then allocator through final scan/widening/callback; widening releases all wrappers; archive/restore use task then allocator; deletion holds allocator through staging/commit. Arbitrary late relationship edits outside the candidate set remain the accepted limit. No global edit lock, instance check, or recovery layer was added. Reviewed source/test byte hashes are recorded externally before the commit hook and will be compared before push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Archive, restore and delete commit moved task-file links under their own paths, for targets inside or outside the repository. Editing through an unchanged committed link still commits its target. The shared Git rule also covers the parent restore finding: both link paths are committed and the target stays unchanged and unstaged.

The exact repaired BACK-720 parent is integrated while preserving its bounded allocator/cleanup locks and complete restored-state publication. Actual commit failures use ChangeNotCommittedError and report the applied change in one sentence through CLI, MCP, and the archive HTTP route. Other failures after deletion retain TaskDeletionAppliedError, including lock release after a successful commit; the shared MCP handler preserves that distinct message.

Verified: 274 focused tests, Bun 1.4.3 types, Biome 2.5.15, build, compiled CLI/browser/MCP smoke, and real compiled commit-failure and post-success release-failure proofs. Full-context review accepted the source. Existing limits remain: the first edit through an uncommitted changed link commits the link only, and arbitrary late relationship edits outside the candidate set are not serialized.
<!-- SECTION:FINAL_SUMMARY:END -->
