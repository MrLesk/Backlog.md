---
id: BACK-378
title: Fix timezone configuration docs and local date display in task modal
status: Done
assignee:
  - '@codex'
created_date: '2026-02-09 06:22'
updated_date: '2026-02-09 06:24'
labels:
  - bug
  - web
  - docs
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/508'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve issue #508 by removing stale timezonePreference configuration documentation and fixing task details modal to display created/updated dates in local time instead of raw stored UTC strings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README no longer documents unsupported `timezonePreference` config key.
- [x] #2 Task details modal displays created/updated dates using local timezone formatting rather than raw storage strings.
- [x] #3 Regression tests cover date parsing/formatting behavior for stored UTC datetime strings used by the web UI.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed stale `timezonePreference` documentation and type definition to match current supported config surface. Added web utility functions to parse stored UTC date strings (`YYYY-MM-DD HH:mm` and date-only) and format for local display. Updated `TaskDetailsModal` created/updated display to use local formatting instead of raw storage strings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Issue #508 resolved by removing unsupported `timezonePreference` config docs/type and fixing task details modal date rendering to display local timezone values from stored UTC strings. Added regression tests in `src/web/utils/date-display.test.ts` for parse/format behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
