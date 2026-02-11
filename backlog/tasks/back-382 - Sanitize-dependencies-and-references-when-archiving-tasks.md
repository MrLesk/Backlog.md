---
id: BACK-382
title: Sanitize dependencies and references when archiving tasks
status: Done
assignee:
  - '@codex'
created_date: '2026-02-11 21:02'
updated_date: '2026-02-11 21:21'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a task is archived, Backlog.md should remove that archived task ID from other active local tasks’ dependencies and exact-ID references. This prevents stale links to archived tasks. Parent task relationships are explicitly out of scope for this change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archiving task X removes X from dependencies of all active local tasks that contain it.
- [x] #2 Archiving task X removes only exact-ID references equal to X (canonical/case-insensitive ID comparison), without removing partial matches in URLs/paths/text.
- [x] #3 parentTaskId is not modified by archive cleanup.
- [x] #4 Cleanup is applied only to active local tasks (backlog/tasks), not to completed or archive folders.
- [x] #5 Archive flows (CLI/MCP/core) still succeed and tests cover cleanup behavior and non-regressions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In Core, add internal archive-sanitization helpers that scan only active local tasks (`filesystem.listTasks`) and remove archived task links from `dependencies` and exact-ID `references`.
2. Use canonical task ID comparison (`taskIdsEqual`) for both dependency cleanup and exact-ID reference cleanup; do not touch `parentTaskId`.
3. Update `archiveTask` flow to run sanitizer after file move succeeds; persist changed tasks via `updateTasksBulk` so auto-commit behavior remains consistent.
4. Add focused regression tests in dependency/reference suites for archive cleanup behavior, including exact-match-only references and case-insensitive ID handling.
5. Run scoped tests + check + typecheck, then update Backlog task criteria/DoD and notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented archive-time sanitization in `Core.archiveTask` to remove archived task IDs from active task `dependencies` and exact-ID `references` only.

Kept `parentTaskId` untouched by design and limited cleanup scope to active local tasks loaded from `filesystem.listTasks()` (no completed/archive rewrites).

Updated archive auto-commit staging to include sanitized active task files alongside the archive file move, so archive + cleanup commit together when autoCommit is enabled.

Added regression tests in `src/test/dependency.test.ts` for dependency cleanup, parent-task preservation, and completed-task non-mutation.

Added regression tests in `src/test/references.test.ts` for exact-ID-only reference removal and non-removal of partial URL/path matches, plus completed-task non-mutation.

Added auto-commit regression test in `src/test/auto-commit.test.ts` to verify archive cleanup changes are committed when autoCommit=true.

Validation passed: `bun test src/test/dependency.test.ts src/test/references.test.ts src/test/auto-commit.test.ts`, `bun run check .`, `bunx tsc --noEmit`.

Post-review adjustment: exact-ID reference cleanup now requires matching task-prefix IDs (e.g., `TASK-1`/`BACK-1`) and intentionally does not remove numeric-only reference strings like `1` to avoid false-positive deletions.

Post-review adjustment: archive cleanup now derives canonical archived ID from the loaded task record before move, fixing numeric archive input behavior for custom task prefixes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented archive-time sanitization for active local tasks so archiving task X removes X from `dependencies` and exact-ID `references` (case-insensitive canonical ID match), while leaving `parentTaskId` unchanged and leaving completed/archive tasks untouched. Added regression coverage in dependency/reference suites for cleanup behavior and non-removal of partial URL/path references, plus an auto-commit regression to verify archive + cleanup changes commit together when autoCommit is enabled. Commit: 8ecc741.

Post-review hardening in commit `ad32f25`: strict prefixed exact-ID reference matching (avoids numeric-only and foreign-prefix false positives), and canonical archived ID resolution from loaded task record to support numeric archive input with custom task prefixes.

Ran required two-subagent review cycle before PR creation; after fixes, final agent passes reported no findings.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
