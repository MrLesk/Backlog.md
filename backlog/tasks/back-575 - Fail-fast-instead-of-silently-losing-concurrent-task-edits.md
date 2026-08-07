---
id: BACK-575
title: Fail fast instead of silently losing concurrent task edits
status: To Do
assignee: []
created_date: '2026-08-07 17:25'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/843'
priority: high
type: bug
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #843. `updateTaskFromInput` (src/core/backlog.ts:2025-2046) is an unlocked read-modify-write that serves CLI `task edit`, the MCP `update_task` tool, and the web PUT handler (src/server/index.ts:1048). Two concurrent edits of the same task silently lose one write while both callers report success. Silent data loss is the worst possible outcome for a tool whose whole value is a reviewable, trustworthy record of work.

Maintainer decision (confirmed): use filesystem-level locking that protects across separate backlog processes, and on contention FAIL FAST with a clear error such as "Edit failed: TASK-X is being modified by another process; retry if appropriate". No waiting, no re-read-and-merge, no automatic retry - the caller decides what to do. The web surface must return HTTP 409 and MCP must surface an appropriate operation error.

Reference material: withdrawn PR #852 from iRonin (fork branch fix/task-edit-locking, commit 7bbf033) contains reusable lock plumbing (a withTaskLock helper alongside the existing withCreateLock in src/file-system/operations.ts) and a strong concurrency test harness (src/test/atomic-task-edit.test.ts and scripts/smoke-parallel-task-locking.sh). Its wait-and-re-read semantics do NOT match the decided fail-fast behavior - reuse the plumbing and the harness, not the semantics. Credit the report from iRonin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Concurrent edits of the same task never silently lose data: one edit succeeds and the other fails
- [ ] #2 The locking protects across separate backlog processes, not only within a single process
- [ ] #3 A losing CLI edit exits non-zero with a clear message naming the task and the contention
- [ ] #4 The web update endpoint returns HTTP 409 on contention
- [ ] #5 The MCP update_task tool returns an appropriate operation error on contention
- [ ] #6 No waiting, merging, or automatic retry happens on contention
- [ ] #7 A concurrency test proves lost-update protection
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
