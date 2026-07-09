---
id: BACK-355.05
title: 'TUI: Display task type in board and detail views'
status: In Progress
assignee:
  - '@impl_types_tui'
created_date: '2026-01-01 23:37'
updated_date: '2026-07-09 23:09'
labels:
  - tui
dependencies:
  - task-355.01
modified_files:
  - src/cli.ts
  - src/ui/board.ts
  - src/ui/components/filter-header.ts
  - src/ui/components/filter-popup.ts
  - src/ui/components/help-popup.ts
  - src/ui/enhanced-views.ts
  - src/ui/simple-unified-view.ts
  - src/ui/task-type.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/unified-view.ts
  - src/test/board-ui.test.ts
  - src/test/help-popup.test.ts
  - src/test/tui-task-type.test.ts
  - src/test/unified-view-filters.test.ts
parent_task_id: BACK-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add visual representation of task types in the terminal UI board view and task detail popup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task cards on kanban board display type with icon or abbreviated badge
- [x] #2 Task detail view shows type field
- [x] #3 Type uses distinct visual styling (color or icon) for quick recognition
- [x] #4 Board can be filtered by type (keyboard shortcut or menu option)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the shared TUI filter header/state with a configured multi-select task-type control and T shortcut.
2. Carry task-type filter state through CLI-seeded unified list/board views and apply the existing shared type matcher.
3. Add one compact, styled task-type badge used by board cards, task-list rows, and detail metadata while leaving untyped tasks unbadged.
4. Add focused regression coverage, then verify focused/full tests, typecheck, Biome, build, and real source plus compiled TUI interaction in a PTY.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery: L2 TUI/state change. Reusing label multi-select, priority configured-value plumbing, shared task-search type matching, and the existing task popup metadata path. Interactive CLI --type must become session filter state rather than an irreversible prefiltered dataset.

Implemented shared configured multi-select task-type filtering across task-list and Kanban TUI views with the T shortcut. CLI-seeded --type filters now remain editable session state instead of permanently narrowing the loaded dataset. Added a shared magenta [type] badge before titles so it stays visible in narrow board columns; the detail pane/popup renders Type metadata, while untyped tasks remain unbadged. Simplification/UX pass also removed duplicated text from shared multi-select choices.

Validation: focused TUI/type suite 38 pass; full suite 1511 pass, 2 expected interactive skips, 0 fail; bunx tsc --noEmit; bun run check .; bun run build; git diff --check. Manual PTY QA covered source and compiled binaries, picker selection, list/board state sharing, detail popup, default types, custom Bug/Epic casing, and untyped behavior.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @impl_types_tui
created: 2026-07-09 23:09
---
Ready for independent review. PTY QA found and fixed the duplicated multi-select copy before handoff.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed human-facing TUI task-type support: compact styled badges in list/board, Type metadata in details, and configurable multi-select filtering shared across views and seeded from CLI --type. Verified default/custom/untyped flows in real PTYs and the compiled binary, with 1511 tests passing and all static/build checks green.
<!-- SECTION:FINAL_SUMMARY:END -->
