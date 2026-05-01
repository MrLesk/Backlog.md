---
id: BACK-456
title: Lock milestone ID allocation during creation
status: To Do
assignee:
  - '@codex'
created_date: '2026-05-01 20:59'
labels:
  - bug
  - milestones
  - mcp
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/619'
modified_files:
  - src/file-system/operations.ts
  - src/test/atomic-task-create.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #619 reports that concurrent MCP milestone creation can allocate the same `m-N` id because `FileSystem.createMilestone()` scans milestone files and writes the new file without holding the shared create lock. Mirror the task creation concurrency fix so milestone scan-and-write is serialized.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Concurrent milestone creation from two Core/FileSystem instances produces unique milestone IDs.
- [ ] #2 Milestone ID allocation includes active and archived milestone files while holding the create lock.
- [ ] #3 The existing task create lock timeout behavior remains unchanged and covered by tests.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
