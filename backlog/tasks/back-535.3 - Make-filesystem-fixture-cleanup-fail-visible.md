---
id: BACK-535.3
title: Make filesystem fixture cleanup fail visible
status: To Do
assignee: []
created_date: '2026-07-11 09:21'
labels: []
dependencies: []
parent_task_id: BACK-535
priority: medium
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mechanically remove redundant pre-clean catches and swallowed filesystem teardown from isolated test fixtures after BACK-535.2 establishes the lifecycle rules. Setup batch: cli-plain-output, draft-create-consistency, cli-parent-filter, acceptance-criteria-structured, desc-alias, cli-milestone-filter, description-newlines, cli, cli-task-milestone, cli-refs-docs, cli-zero-padded-ids, cleanup, and cli-plain-create-edit. Teardown batch: the filesystem-only safeCleanup/rm catch sites classified in BACK-535.2; exclude MCP/server/client/process ownership covered by BACK-535.4. Keep batches reviewable and prove Windows cleanup behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Redundant pre-clean operations are removed from unique fixture paths
- [ ] #2 Filesystem teardown failures are no longer swallowed
- [ ] #3 Focused suites pass repeated Windows-equivalent stress and the full suite remains green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
