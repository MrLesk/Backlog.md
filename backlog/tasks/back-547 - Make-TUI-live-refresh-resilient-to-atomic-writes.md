---
id: BACK-547
title: Make TUI live refresh resilient to atomic writes
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-07-14 19:59'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/786'
priority: high
type: bug
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v1.48.0 packaged TUI can miss the single filesystem event emitted during CLI create, edit, or archive operations because the watcher reads before the task file is stable, receives no later event, and remains stale until restart. Current source remains timing-dependent. This repairs existing live refresh behavior, not a new feature. Scope is the current checkout only. Cross-branch and separate-worktree refresh are explicitly excluded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLI and atomic external create, edit, status, archive, and delete operations refresh the open board and list reliably without restart.
- [ ] #2 The watcher retries, debounces, or reconciles create and change events until the file parses stably or absence is confirmed, without infinite retries or duplicate updates.
- [ ] #3 Selection remains valid when the selected task changes, moves status, archives, or deletes, and active filters reflect reconciled state.
- [ ] #4 Configuration and status updates continue refreshing correctly.
- [ ] #5 Cross-branch and separate-worktree changes are explicitly out of scope.
- [ ] #6 Real filesystem tests cover single-event partial create, edit, archive or delete, and recovery and error bounds. Integration tests cover unified-view callback behavior.
- [ ] #7 A compiled-binary PTY smoke test verifies that a packaged CLI mutation becomes visible in the open TUI within a bounded time on supported CI platforms.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
