---
id: BACK-651
title: Remove the temp-file roundtrip in README board export
status: Done
assignee:
  - '@claude'
created_date: '2026-08-29 21:06'
updated_date: '2026-08-29 21:08'
labels: []
dependencies: []
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
updateReadmeWithBoard writes the generated Kanban board to a fixed .temp-board.md in the current working directory, reads it back, then shells out with Bun.$ to delete it. The board string is already available in memory from generateKanbanBoardWithMetadata, so the roundtrip adds nothing but failure modes: concurrent exports in the same directory clobber each other's temp file, a crash between write and cleanup leaves .temp-board.md in the user's repository, and the cleanup path spawns a shell. Generate the board in memory instead. Takes over the readme.ts portion of contributor PR #895 (pxmpsdev).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 updateReadmeWithBoard produces the same README board section without creating or deleting any temporary file
- [x] #2 No .temp-board.md remains in the working directory after a README board export
- [x] #3 Tests cover updateReadmeWithBoard writing the board between the BOARD_START/BOARD_END markers
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebase contributor PR #895 onto origin/main keeping only the src/readme.ts change; drop the stale BACK-619 doc commits (their task file duplicates main's back-619 ID under a different filename) and the cosmetic [...items] spread in src/board.ts (sortedItems is function-local, no observable bug).
2. In src/readme.ts, call generateKanbanBoardWithMetadata directly instead of exportKanbanBoardToFile + Bun.file read + Bun.$ rm of .temp-board.md.
3. Add src/test/readme-board.test.ts covering updateReadmeWithBoard: board section written between BOARD_START/BOARD_END, existing section replaced on re-run, and no .temp-board.md left behind.
4. Verify with bunx tsc --noEmit, bun run check ., and the scoped test files.
5. Commit the readme.ts fix with the contributor's authorship preserved, then the test and this task record, and push to the PR branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Took over contributor PR #895 (pxmpsdev) in place, rebased onto origin/main and stripped to the readme.ts fix.

Kept: src/readme.ts now calls generateKanbanBoardWithMetadata directly. Original commit authorship (Ubuntu <ubuntu@projekte.cyou>) preserved, with a Co-authored-by trailer for pxmpsdev.

Dropped:
- The four BACK-619 doc commits (README.md / ADVANCED-CONFIG.md backlog_directory wording). Their task file 'back-619 - Fix-README-example-for-custom-backlog-directory-...' uses a different filename than the back-619 file already on main, so merging it would put two files under one task ID.
- The [...items] spread in src/board.ts. sortedItems is derived inside generateKanbanBoardWithMetadata from a Map that the same function builds and then discards, so the in-place sort is not observable by any caller; no bug to fix.

Tests: new src/test/readme-board.test.ts (none existed for updateReadmeWithBoard on main) covers marker replacement, idempotent re-run, marker-less append with version suffix, README creation, and that an unrelated .temp-board.md in the working directory is left alone. That last case is the discriminating one: it fails on pre-fix main (ENOENT - the old 'rm -f .temp-board.md' cleanup deleted the user's file) and passes after the change. The other four pass on both revisions, since the old happy path did clean up after itself.

Note: no BACK-647 record ever existed in any branch or PR. The CLI allocator assigned BACK-651 (647-650 are held by other in-flight sessions); per CLAUDE.md the allocator's ID was used rather than hand-picking one.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/readme.ts generates the README board in memory via generateKanbanBoardWithMetadata instead of writing the fixed .temp-board.md in the current working directory, reading it back, and shelling out with Bun.$ to delete it. This removes a same-directory concurrency clobber, a stray .temp-board.md left behind on any crash between write and cleanup, a shell spawn, and a 'rm -f' that destroyed any unrelated user file named .temp-board.md. Verified with bunx tsc --noEmit (clean), bun run check . (390 files, clean), and bun test on readme-board/board/board-command/markdown (60 pass, 0 fail); the new stray-file test fails on pre-fix main and passes after.
<!-- SECTION:FINAL_SUMMARY:END -->
