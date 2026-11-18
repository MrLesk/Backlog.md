---
id: BACK-803
title: Archive drafts from the browser through the draft lifecycle
status: Done
assignee:
  - '@codex'
created_date: '2026-11-16T21:09:00Z'
updated_date: '2026-11-16T22:10:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1209
  - src/server/index.ts
  - src/test/server-drafts-endpoint.test.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/test/commit-failure-after-change.test.ts
modified_files:
  - src/test/server-drafts-endpoint.test.ts
  - src/server/index.ts
  - src/test/commit-failure-after-change.test.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
priority: high
type: bug
ordinal: 408000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser offers Archive for drafts, but its shared archive endpoint always calls the task lifecycle and returns 404. Reproduced on main at 373a16dd using a fresh filesystem-only project: POST /api/tasks/DRAFT-1/archive returns Task DRAFT-1 not found and leaves the draft active. Route the existing action to the same draft lifecycle as the CLI; draft ID allocation is outside this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archiving a draft from the browser moves its existing file to archive/drafts and removes it from the next draft listing.
- [x] #2 A missing draft returns 404; ambiguous draft identity and a held draft lock return 409 without moving any draft.
- [x] #3 The task archive route keeps its existing task behavior.
- [x] #4 An existing draft archive file or symlink is left unchanged, and archive refusal leaves the source draft active.
- [x] #5 A draft that moved before auto-commit failed produces the existing moved-state response and refreshes the browser listing.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the existing server draft-endpoint tests for archive success, missing IDs, ambiguous identities and held locks; show the regression on current main.
2. Dispatch draft archive IDs to Core.archiveDraft and map draft identity/lock conflicts to HTTP 409, keeping task archiving unchanged.
3. Run the focused server and draft lifecycle checks, TypeScript and Biome; review the diff, finalize the task and publish its PR.

4. Address GitHub review findings in the draft lifecycle: use an exclusive archive write, and preserve the existing moved-state response if auto-commit fails after a successful move.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Current-main reproduction: draft archive returned 404. The new success, lock and ambiguity assertions failed before the dispatch fix. After the fix, 30 tests pass across server-drafts-endpoint, server-cleanup-endpoint and draft-lifecycle-autocommit-scope; bun run check:types and bun run check pass. Existing task archive tests cover the unchanged task lifecycle. Self-review confirms a single ID-based dispatch and existing error mappings, with no change to draft allocation.

GitHub review follow-up: reproduced both destination overwrite cases and the missing post-move response before the fixes (three failing regressions). Draft archiving now uses exclusive creation and leaves an existing file or symlink and the active draft unchanged. Post-move commit failures use ChangeNotCommittedError with archiveState=moved so the existing HTTP handler broadcasts a refresh. All 50 tests across the draft endpoint, commit failure, lifecycle commit scope and cleanup endpoint files pass; types and Biome pass. Self-review confirms no allocator change and reuse of the existing moved-state contract.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Browser Archive uses the draft lifecycle. Existing archive files and symlinks are preserved; missing, ambiguous and locked draft handling remains covered. A failed commit after a successful move reports archiveState=moved so the browser refreshes. All 50 focused checks, types and Biome pass. Draft ID allocation is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
