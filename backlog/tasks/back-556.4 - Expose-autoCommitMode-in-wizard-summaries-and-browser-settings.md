---
id: BACK-556.4
title: 'Expose autoCommitMode in wizard, summaries, and browser settings'
status: Done
assignee:
  - '@andreas'
created_date: '2026-07-28 14:47'
updated_date: '2026-07-28 18:23'
labels:
  - web-ui
  - cli
dependencies:
  - BACK-556.3
parent_task_id: BACK-556
priority: low
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose `autoCommitMode` in the human-facing configuration surfaces once BACK-556.3 has established it in the shared model and canonical CLI.

This covers the advanced CLI wizard, initialization and configuration summaries, and browser initialization and Settings. These surfaces must not weaken the validation established in BACK-556.3. Their human-readable copy must explain the conditional behavior accurately: `amend-own` may replace the exact current locally-owned Backlog tip when all safety checks pass, and otherwise creates a new commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The advanced CLI wizard offers autoCommitMode, defaults to the current configured value, and presents it in a way that makes sense only when auto commit is enabled.
- [x] #2 Initialization and configuration summaries show the effective autoCommitMode.
- [x] #3 Browser initialization and Settings expose autoCommitMode, reject invalid values, and round-trip through the shared typed and serialized configuration paths.
- [x] #4 Human-readable copy on the CLI wizard and browser surfaces states that amend-own may replace the exact current locally-owned Backlog tip only when all safety checks pass and otherwise creates a new commit.
- [x] #5 Tests cover wizard defaults and output, summary rendering, and browser initialization and Settings round-trips.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the conditional auto-commit mode selector to the advanced CLI wizard and preserve it through init/config saves.
2. Expose the same selector and safety explanation in browser initialization and Settings, including API validation.
3. Show the effective mode in init/config/browser summaries and add round-trip UI/API regression tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added conditional new/amend-own selectors to the advanced CLI wizard, browser initialization, and Settings with explicit safety/fallback copy. Persisted the mode through init and Settings APIs, added strict browser endpoint validation, displayed effective modes in CLI and browser summaries, and covered wizard defaults, summaries, browser initialization, Settings, and API round trips.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Users can now choose autoCommitMode consistently during CLI or browser setup and in Settings. Enabled summaries show the effective mode, unsafe values are rejected before writes, and the UI explains that replacement occurs only for an exact locally-owned tip after all safety checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
