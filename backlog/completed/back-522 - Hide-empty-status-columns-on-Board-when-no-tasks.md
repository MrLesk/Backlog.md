---
id: BACK-522
title: Hide empty status columns on Board when no tasks
status: Done
assignee: []
created_date: '2026-07-08 19:33'
updated_date: '2026-07-10 19:34'
labels:
  - ui
  - enhancement
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/660'
modified_files:
  - src/cli.ts
  - src/file-system/operations.ts
  - src/test/config-commands.test.ts
  - src/types/index.ts
  - src/web/App.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/Settings.tsx
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a board column has no tasks, hide it to reduce clutter. To preserve drag-and-drop usability, empty columns reappear while a task is being dragged so they remain valid drop targets. Add a new `hideEmptyColumns` boolean to `BacklogConfig` (default false) so existing users see no change; opt-in users get the cleaner board. Surface the toggle in the Settings page.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an optional hideEmptyColumns boolean with default-off behavior and expose it through Settings, CLI config, and YAML serialization.
2. Derive visible board statuses from existing lane/task data, hide empty statuses only while enabled and idle, and restore all statuses during drag.
3. Cover config round-trip behavior and verify typecheck, formatting, the full suite, and persisted configuration.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Historical record reconciliation: PR #660 shipped this feature in commit 17ca0bfdb2af64dc3ff972b8a2b0f07f82ba04a3 under the colliding ID BACK-466. The legitimate BACK-466 Windows-on-ARM record remains unchanged. Commit a806a2c renamed only this duplicate task record to BACK-522.

The shipped implementation adds the default-off hideEmptyColumns config across Settings, CLI get/set/list, YAML persistence, and the browser board. When enabled and no drag is active, the board filters statuses with no visible tasks; while dragging, all statuses return as drop targets. The original change reported clean TypeScript, targeted Biome, 1244 passing tests with 2 skips and 0 failures, and a manual config API persistence smoke; suggested manual board interaction was not recorded as completed.

Exact-main finalization verification on e9dc9c5bf5124f217352e1bc9b271d07323f036c (2026-07-10): bunx tsc --noEmit passed; bun run check . passed across 324 files; bun test passed 1643 tests with 2 expected interactive skips and 0 failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reconciled the record for the opt-in hide-empty-columns feature shipped by PR #660 in commit 17ca0bfdb2af64dc3ff972b8a2b0f07f82ba04a3 under the historical colliding ID BACK-466; the legitimate Windows-on-ARM BACK-466 record is unchanged. When enabled, the board hides status columns with no visible tasks and restores them during drag, while Settings, CLI, and YAML persist the default-off option. Verified on exact shipped main e9dc9c5bf5124f217352e1bc9b271d07323f036c with TypeScript, Biome across 324 files, and 1643 passing tests, 2 expected interactive skips, and 0 failures.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
