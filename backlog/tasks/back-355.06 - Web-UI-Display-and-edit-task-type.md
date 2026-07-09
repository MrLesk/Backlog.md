---
id: BACK-355.06
title: 'Web UI: Display and edit task type'
status: Done
assignee:
  - '@impl_types_web'
created_date: '2026-01-01 23:38'
updated_date: '2026-07-09 23:25'
labels:
  - web
dependencies:
  - task-355.01
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
Context brief: L2 cross-surface change. Reuse TaskCard badge, TaskDetailsModal priority selector, BoardPage/Board URL filter, and server priority mutation patterns. Use getTaskTypeValues/resolveTaskTypeValue/matchesTaskTypeFilter so custom casing and defaults remain canonical. Existing untyped tasks must render no badge and create must default to No type. Historical types removed from config must remain visible without being silently rewritten; cross-branch selectors remain disabled. Mobile is intentionally out of scope.

Implemented the Web task-type flow through the existing Core validation path: create/update API pass-through, configured/default type selector with No type as the create default, legacy configured-value preservation, deterministic distinct badges, and canonical URL-backed board filtering. Adjusted the desktop board header into intentional title/action and controls rows after visual QA exposed an accidental wrap.

Validation after rebasing onto origin/main f48225bd: 39 focused server/Web tests passed; bunx tsc --noEmit, bun run check ., bun run build, and the full bun test suite passed. Browser plugin was unavailable, so the permitted Playwright fallback used cached Playwright 1.60/Chromium at 1440x1000 against the compiled binary. Verified page identity, meaningful content, no framework overlay, custom/default/untyped badges, filter URL and results, create default/options, create 201, edit 200, keyboard focus, and zero console warnings/errors or page errors. Screenshots: /tmp/backlog-back-35506-web.O3wQN6/qa-screenshots/{board-types,board-filtered,task-detail-type,task-create-type,board-created}.png. Mobile remains intentionally out of scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed human-facing task types in the desktop Web UI. Task cards now show consistent, distinct badges; task detail and create flows expose configured type selectors without defaulting existing or new tasks; edits and clears persist through Core validation; and the board has a canonical URL-backed type filter. Added focused server and React coverage and verified the compiled desktop flow visually with custom and untyped tasks.
<!-- SECTION:FINAL_SUMMARY:END -->
