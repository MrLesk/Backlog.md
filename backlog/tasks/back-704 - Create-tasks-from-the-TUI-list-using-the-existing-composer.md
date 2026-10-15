---
id: BACK-704
title: Create tasks from the TUI list using the existing composer
status: Done
assignee:
  - '@codex-list-creation'
created_date: '2026-09-27 23:01'
updated_date: '2026-09-27 23:25'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/964'
  - 'https://github.com/MrLesk/Backlog.md/pull/963'
modified_files:
  - src/ui/task-lifecycle.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/unified-view.ts
  - src/ui/footer-content.ts
  - src/ui/components/help-popup.ts
  - src/test/tui-task-composer.test.ts
  - src/test/unified-view-loading.test.ts
  - src/test/tui-task-list-new-task-binding.test.ts
type: enhancement
ordinal: 334000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair contributor PR #963 so the TUI task list uses the same task composer and shared creation path as the board. Keep list navigation usable after creation, cancellation, and filtered or draft results, and retain the existing contributor PR and authorship.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing new-task shortcut opens the shared composer from the TUI list and creates through Core using project configuration.
- [x] #2 A visible created task appears once and becomes selected, including when a watcher delivers it while the composer is open.
- [x] #3 Draft or filtered-out creation, cancellation, and errors preserve usable keyboard focus and give the existing concise outcome feedback.
- [x] #4 Help matches the supported shortcut, no independent task-creation model is added, and contributor history is preserved.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Continue contributor PR #963 while preserving commit 82ce552fedc936a355e766721fa3374456f11956 and its authorship.
2. Add n/N/S-n to the task list using the existing composer and Core.createTaskFromInput. Share configured persistence, upsert, and board/list outcome feedback through the existing TUI lifecycle module. Keep one unified-view creation callback and use the viewer fallback for standalone task view.
3. Defer list widget rebuilds while the composer owns focus. Reconcile the created task by ID, apply existing filters unchanged, select visible results, and restore usable list/detail focus after hidden or draft results, cancellation, and errors. Include the first late watcher delivery of the created task without broadening into unrelated navigation cleanup.
4. Keep footer/help aligned with the shortcut. Preserve BACK-591's unresolved filter policy. At later BACK-694 integration, omit or disable creation in archived read-only views.
5. Verify the actual composer and Core path, project defaults, watcher timing, exactly one created row, and keyboard focus through the existing screen harness and real CLI terminal checks. Run focused tests, TypeScript, and Biome, then review ownership and duplication for possible simplification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The list and board now use the existing composer and one shared configured persistence path. Shared upsert and outcome helpers replace duplicated logic, and the unified view uses one creation callback. The standalone CLI needs no extra callback. Creation does not change or inherit active filters.

A regression reproduced the contributor implementation's lost focus after filtered-out creation. The repair also covers creation from the detail pane, draft results, cancellation, setup errors, persistence retry/cancel, and watcher delivery before persistence, before composer close, and after close.

Validation: 123 focused tests passed across list creation, composer, unified loading/filters, runtime working directory, and TUI lifecycle, with no failures or errors. bunx tsc --noEmit, bun run check . (438 files), and git diff --check passed. Real CLI terminal checks passed visible creation, arrow navigation, reopening and Escape cancellation, and filtered-out creation followed by navigation. Core reads confirmed exactly one record per submission, inherited assignee and Definition of Done, and no priority-filter inheritance.

Full-context architecture review found no blocker or worthwhile subtraction. The verified PR continuation candidate preserves the original contributor commit as an ancestor and contains exactly the nine reviewed source/test files plus this task record.

BACK-591 remains unchanged. Later BACK-694 archive-view integration must omit or disable this creation shortcut in archived read-only views.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added task creation to the TUI list through the shared composer and Core persistence. Visible tasks appear once and receive focus; hidden, draft, canceled, and failed results keep navigation usable. Shared lifecycle helpers remove duplicated creation logic, and contributor history is preserved. Verified by 123 focused tests, TypeScript, full Biome, real CLI terminal checks, and architecture review. Later archive-view integration must disable creation in archived read-only views.
<!-- SECTION:FINAL_SUMMARY:END -->
