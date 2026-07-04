---
id: BACK-421
title: Resolve dateFormat config behavior
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-04 14:19'
labels:
  - config
  - bug
  - cleanup
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/461'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #461: dateFormat/date_format is configurable but inconsistently applied.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The project either honors dateFormat consistently or deprecates/removes it from the public config surface.
- [x] #2 CLI, Web UI, settings, and docs agree on the supported date behavior.
- [x] #3 Tests cover the chosen behavior and any legacy fallback.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend formatUtcDateForDisplay in src/utils/utc-date-display.ts with dateFormat option: normalize to canonical, then re-arrange tokens (yyyy/mm/dd date part; hh:mm time part, case-insensitive, single-pass). Invalid format -> canonical; unparseable value -> as-is. If stored value has time, always render it (format time part or append canonical HH:mm); date-only never invents 00:00.
2. Storage stays canonical YYYY-MM-DD[ HH:mm]; --plain CLI and MCP outputs stay canonical (agent contract).
3. TUI wiring: thread config?.dateFormat through task-viewer-with-search.ts (generateDetailContent, createTaskPopup), board.ts, sequences.ts; cleanup preview in cli.ts.
4. Web wiring: formatStoredUtcDateForDisplay(dateStr, dateFormat?) delegates to shared helper; compact display absolute fallback routed through it; pass config?.dateFormat from App.tsx to TaskDetailsModal, TaskList/CleanupModal, DraftsList, DocumentationDetail, DecisionDetail, Statistics.
5. Settings.tsx helper text: display-only, does not change stored markdown.
6. Docs: ADVANCED-CONFIG.md default yyyy-mm-dd + display-only semantics.
7. Tests: extend src/test/utc-date-display.test.ts; update src/web/utils/date-display.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented dateFormat as a display-only formatter. Core: extended formatUtcDateForDisplay (src/utils/utc-date-display.ts) with a dateFormat option — canonical normalization first, then single-pass token rearrangement (date part: yyyy/mm/dd each exactly once, case-insensitive, other chars literal; time part after first whitespace: hh/mm). Stored times are always rendered (via format time part or appended canonical HH:mm); date-only values never invent a time; invalid formats and unparseable values fall back gracefully. Storage stays canonical yyyy-mm-dd[ hh:mm]; --plain CLI and MCP output remain canonical (agent contract untouched). TUI: threaded config dateFormat through viewTaskEnhanced/generateDetailContent/createTaskPopup, board (renderBoardTui option), sequences view, and cli cleanup preview. Web: formatStoredUtcDateForDisplay/formatStoredUtcDateForCompactDisplay now delegate to the shared helper (as-stored UTC reformatting instead of browser-locale rendering; compact relative labels kept, absolute fallback stays date-only); dateFormat passed from App config to TaskDetailsModal, TaskList/CleanupModal, DraftsList, DocumentationDetail, DecisionDetail, Statistics. Settings gained helper text (display-only). ADVANCED-CONFIG.md documents default yyyy-mm-dd and the token/time rules. Validation: bunx tsc --noEmit clean, biome check clean, bun test 1389 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
dateFormat is now a working display-only formatter: the web UI and TUI rearrange canonical UTC dates per the configured format (e.g. dd/mm/yyyy), while task/doc/decision markdown storage, --plain CLI output, and MCP responses stay canonical yyyy-mm-dd[ hh:mm]. Invalid formats fall back to canonical output; stored times are always shown; date-only values never gain a time. Docs and Settings describe the display-only semantics. Verified with new unit tests (core + web), bunx tsc --noEmit, biome, and the full bun test suite (1389 pass).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
