---
id: BACK-803
title: Archive drafts from the browser through the draft lifecycle
status: Done
assignee:
  - '@codex'
created_date: '2026-11-16T21:09:00Z'
updated_date: '2026-11-16T21:11:00Z'
labels: []
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/1209
  - src/server/index.ts
  - src/test/server-drafts-endpoint.test.ts
modified_files:
  - src/test/server-drafts-endpoint.test.ts
  - src/server/index.ts
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Current-main reproduction: draft archive returned 404. The new success, lock and ambiguity assertions failed before the dispatch fix. After the fix, 30 tests pass across server-drafts-endpoint, server-cleanup-endpoint and draft-lifecycle-autocommit-scope; bun run check:types and bun run check pass. Existing task archive tests cover the unchanged task lifecycle. Self-review confirms a single ID-based dispatch and existing error mappings, with no change to draft allocation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Browser Archive now calls the existing draft archive lifecycle for DRAFT IDs. Missing drafts return 404; ambiguous IDs and held draft locks return 409 without moving files. Focused HTTP and lifecycle tests, types and Biome pass.
<!-- SECTION:FINAL_SUMMARY:END -->
