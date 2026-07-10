---
id: BACK-355.06
title: 'Web UI: Display and edit task type'
status: Done
assignee:
  - '@pr751-takeover'
created_date: '2026-01-01 23:38'
updated_date: '2026-07-10 17:15'
labels:
  - web
dependencies:
  - task-355.01
modified_files:
  - src/web/components/Board.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-board-filters.test.tsx
  - src/test/web-task-types.test.tsx
parent_task_id: BACK-355
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add task type display and editing capabilities to the web interface, including task cards, detail modal, and create form.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task cards display type badge with appropriate styling
- [x] #2 Task detail modal shows type field
- [x] #3 Task create form includes type dropdown selector
- [x] #4 Task edit allows changing type via dropdown
- [x] #5 Type badges use consistent color scheme for visual distinction
- [x] #6 Board view can be filtered by type
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pass task type through the Web create/update API while relying on core configured-value validation.
2. Add a reusable task-type badge and configured selector to desktop task cards and task detail/create flows, preserving untyped and read-only behavior.
3. Add a URL-backed board type filter using the shared type configuration helpers.
4. Cover server mutations and Web display/create/edit/filter behavior with focused tests, then run desktop rendered QA and the full validation suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the Web task-type flow through the existing Core validation path: configured and default type display, create and edit selectors with No type as the default, historical removed values preserved without silent rewrites, deterministic badges, canonical URL-backed board filtering, accessible create and edit errors, and latest-request-wins state handling. The board header now uses intentional title/action and controls rows after rendered QA exposed an accidental wrap.

Integrated current main non-destructively and preserved the landed task-route behavior from #755: cosmetic slugs, exact task identity, board query preservation through task links and sidebar search, coherent close/Back/Forward history, focus return, stale-route rejection, and fail-closed missing or ambiguous task errors.

Final verification on frozen binary diff 5a51d769c15a99b1179fba4f1913f5ea70286e3b797bfa49b3c8b47ba5f0e86f: focused route/type/layout tests 37/37 passed with 314 assertions; authoritative full suite 1599 passed, 2 expected interactive TUI skips, 0 failed, 6465 assertions across 1601 tests and 185 files; bunx tsc --noEmit, bun run check ., git diff --check, and bun run build passed. Chrome QA at 1440x1000 and desktop-browser stress at 390x844 verified the two-row header, custom/default/untyped and historical badges, URL filtering, create/edit/clear and validation recovery, keyboard and history behavior, no document overflow, Kanban-owned horizontal scrolling, modal-owned vertical scrolling, zero framework overlays, and zero console warnings or errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the human-facing Web task-type workflow with configured badges, create/edit/clear selectors, canonical URL filtering, accessible validation recovery, and race-safe refresh behavior. Preserved #755 route, query, history, focus, and fail-closed task identity behavior while integrating current main, and repaired the board header into intentional title/action and controls rows. Verified with 37 focused tests, the full 1599-pass suite with 2 expected skips and 0 failures, all static/build gates, and Chrome at 1440x1000 plus 390x844.
<!-- SECTION:FINAL_SUMMARY:END -->
