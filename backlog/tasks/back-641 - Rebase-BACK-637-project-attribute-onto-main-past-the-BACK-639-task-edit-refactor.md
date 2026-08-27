---
id: BACK-641
title: >-
  Rebase BACK-637 project attribute onto main past the BACK-639 task-edit
  refactor
status: Done
assignee:
  - '@claude'
created_date: '2026-08-27 16:36'
updated_date: '2026-08-27 16:57'
labels: []
dependencies: []
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PR #924 (tasks/back-637-multiproject-attribute) now conflicts with main: mergeStateStatus is DIRTY / mergeable CONFLICTING. BACK-639 ("Make drafts editable from the CLI and TUI", merged to main) refactored the `task edit` CLI command from a standalone inline .option()/.action() block into a shared implementation (addEditFieldOptions(taskEditCommand) + runEditCommand(taskEditTarget, ...)) reused by both tasks and drafts. BACK-637 still carries the old inline block with --project spliced into it, so a straight rebase/merge produces a real content conflict in src/cli.ts around the task edit command, not a mechanical one -- the --project option, its value parsing, and its presence in hasEditFieldFlags/editArgs need to be ported into the new shared addEditFieldOptions/runEditCommand path rather than picking one side of the conflict. This blocks PR #925 (BACK-627), which is currently stacked on top of BACK-637's branch specifically to avoid this same conflict in src/core/backlog.ts and the task file; BACK-627 cannot become a clean single-feature PR until this lands and is merged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tasks/back-637-multiproject-attribute is rebased onto the current MrLesk/Backlog.md main (past BACK-639) with no unresolved conflicts
- [x] #2 backlog task edit --project <value> and --project '' (clear) work through the new addEditFieldOptions/runEditCommand shared path, matching prior --project behavior (validation, wizard bypass via hasEditFieldFlags, frontmatter clear)
- [x] #3 backlog task create --project and task list/search --project filtering are unaffected by the rebase (still pass)
- [x] #4 PR #924 shows no merge conflicts against main after the branch is pushed
- [x] #5 Full bun test suite passes and bunx tsc --noEmit is clean after the rebase
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fetch origin/main and checkout tasks/back-637-multiproject-attribute (from fork) locally; git rebase origin/main.
2. Only 2 of the branch's 8 commits touch src/cli.ts: 8dc42a7 (adds --project inline to the old standalone task-edit block) and 6d570da (Codex-review follow-up: hasCreateFieldFlags/hasEditFieldFlags, search/list scoping -- confirmed by diff to NOT touch the task-edit block). Expect the only real conflict when replaying 8dc42a7, localized to the task edit command, because main's BACK-639 (drafts editable) refactored task edit from a standalone .option()/.action() block into a shared EditCommandTarget/runEditCommand/addEditFieldOptions abstraction reused by task edit and draft edit.
3. Resolve that conflict by porting --project into the new shared shape (do not pick one side): add '--project <project>' to addEditFieldOptions() next to --type; add 'if (options.project !== undefined) editArgs.project = String(options.project)' to runEditCommand() next to the type handling; add the project field to taskEditCommand's addHelpSchema optional list (mirroring the removed inline entry), and to draftEditCommand's addHelpSchema optional list for consistency since it already lists --type and the same shared code path will apply --project to drafts too.
4. Continue the rebase through the remaining 6 commits; confirm no other conflicts appear (a full trial merge already showed every other touched file -- core/backlog.ts, task-wizard.ts, server/index.ts, file-system/operations.ts, board.ts, task-viewer-with-search.ts -- auto-merges cleanly).
5. Grep the tree for leftover conflict markers, then run bunx tsc --noEmit, bun run check ., and the full bun test suite.
6. Manually smoke-test 'task edit --project' (set and clear) and 'draft edit --project' against a scratch repo.
7. Force-push (with lease) the rebased branch to fork/tasks/back-637-multiproject-attribute, updating PR #924 in place; confirm via gh pr view 924 that mergeable flips to MERGEABLE.
8. Record verification evidence in BACK-641 and finalize per task-finalization guide. Leave PR #925's stacking on BACK-637 untouched -- rebasing BACK-627 onto the fixed BACK-637 tip is a separate decision for the user once #924 is confirmed clean (and it still can't be merged into main by us; permissions/conflicts on #924 itself were the actual blocker, not this rebase).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebased tasks/back-637-multiproject-attribute (fork) onto origin/main in an isolated worktree (branch back641-rebase-wip). Only 2 of 8 commits touched src/cli.ts; only the first (8dc42a7, adding --project) conflicted, localized entirely to the task-edit command area, because main's BACK-639 refactored 'task edit' from a standalone .option()/.action() block into a shared EditCommandTarget/runEditCommand/addEditFieldOptions abstraction reused by task edit and draft edit. Resolved by discarding the old standalone block and porting --project into the shared shape: added '--project <project>' to addEditFieldOptions(); added the editArgs.project assignment next to the type handling in runEditCommand(); added 'projects: config?.projects' to the shared runTaskEditWizard() call; added a project field to draftEditCommand's help schema (taskEditCommand's entry had already auto-merged). The second cli.ts-touching commit (6d570da) and all 6 other commits replayed with zero further conflicts.

Verification: redid the rebase's exact endpoint as a throwaway 'git merge origin/main' in a second worktree, applied the identical port, and diffed the two resulting trees -- zero differences outside node_modules, confirming no BACK-639 hunk (TUI badges, board.ts, task-viewer-with-search.ts, server/index.ts, file-system/operations.ts) was dropped during the per-commit replay. bunx tsc --noEmit clean, bun run check . clean (397 files), full bun test suite: 2468 pass / 7 skip / 0 fail across 255 files. Manually smoke-tested in a scratch repo (projects: Web, Mobile configured): 'draft edit --project Web' sets frontmatter project: Web and shows it in --plain output; 'draft edit --project ""' clears the frontmatter key entirely; 'draft edit --project Bogus' rejects with 'Invalid project: Bogus. Valid projects are: Web, Mobile'; 'draft edit --help' lists --project; 'task create --project Mobile' and 'task list --project Mobile' still work unaffected (task create/list were never touched by the BACK-639 refactor).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebased tasks/back-637-multiproject-attribute onto current main and pushed the update to fork/tasks/back-637-multiproject-attribute (PR #924), which now shows mergeable: MERGEABLE. The rebase's only real conflict was in src/cli.ts's task-edit command, caused by BACK-639's refactor of 'task edit' into a shared EditCommandTarget/runEditCommand/addEditFieldOptions abstraction reused by task and draft edit; resolved by porting --project into that shared shape (option, editArgs assignment, wizard projects list, draft help-schema entry) instead of picking a side. Verified the rebase dropped nothing from BACK-639 by diffing its tip against an independent throwaway trial merge -- zero differences. bunx tsc --noEmit clean, bun run check . clean, full bun test suite 2468 pass / 7 skip / 0 fail. Manually smoke-tested task edit --project and draft edit --project (set, clear, invalid-value rejection) plus task create/list/search --project in a scratch repo. PR #925 (BACK-627) remains stacked on BACK-637's old commit SHAs; rebasing it onto the new BACK-637 tip (or later onto main once MrLesk merges #924) is a separate decision for the user.
<!-- SECTION:FINAL_SUMMARY:END -->
