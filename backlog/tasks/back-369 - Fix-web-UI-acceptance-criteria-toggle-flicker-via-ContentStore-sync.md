---
id: BACK-369
title: Fix web UI acceptance criteria toggle flicker via ContentStore sync
status: Done
assignee:
  - '@codex'
created_date: '2026-01-21 18:57'
updated_date: '2026-01-21 19:14'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/492'
  - 'https://github.com/MrLesk/Backlog.md/pull/493'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users report acceptance criteria checkboxes visually unchecking in the web UI even though the state saves (Issue #492). Update core storage synchronization so UI/search refreshes see the updated task immediately instead of stale snapshots.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Updating a task refreshes ContentStore immediately so the UI/search see the new acceptance criteria state without flicker.
- [x] #2 Creating a task immediately appears in ContentStore-backed UI/search without waiting for filesystem watchers.
- [x] #3 Server interfaces do not contain ContentStore-specific business logic for this fix.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
(Retroactive) Update core `updateTask` to upsert into ContentStore after save for immediate UI/search freshness.
Update core `createTask` to upsert into ContentStore after save so new tasks appear immediately.
Remove server-layer ContentStore upsert now that core handles it.
Validate by manual reasoning and (if run) relevant checks; document outcome in notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Retroactive workflow: implementation was completed before task creation due to user request. Plan recorded to capture what was done.

Tests: `bunx tsc --noEmit` passed; `bun test` passed.

`bun run check .` failed due to pre-existing formatting differences in unrelated files (see CLI output); left DoD #2 unchecked.

Summary:
- Sync ContentStore on core task updates so UI/search refreshes use up-to-date acceptance criteria state.
- Sync ContentStore on task creation for immediate UI/search visibility.
- Removed server-layer ContentStore refresh logic now handled in core.

PR: https://github.com/MrLesk/Backlog.md/pull/493

Follow-up: adjusted ContentStore sync to upsert the normalized task loaded from disk after save (avoids overwriting canonical fields like filePath/parentTaskId).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
