---
id: BACK-493
title: Add actualStart and actualEnd support for milestones
status: Draft
assignee:
  - '@kimi'
created_date: '2026-05-28 01:55'
updated_date: '2026-05-28 02:58'
labels: []
dependencies:
  - 'BACK-492'
references: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the `actualStart` and `actualEnd` fields introduced in BACK-492 to **milestones**, with auto-population driven by task status changes within the milestone.

**Auto-population rules:**
- When any task belonging to a milestone transitions to an in-progress status (e.g., "In Progress"), if the milestone's `actualStart` is empty, it is automatically set to the current date-time (`YYYY-MM-DD HH:MM`).
- When the **last remaining non-terminal task** belonging to a milestone transitions to a terminal/Done status, if the milestone's `actualEnd` is empty, it is automatically set to the current date-time.

Users can manually override these values via CLI and Web UI.

**Scope:**
- Add `actualStart` and `actualEnd` to `Milestone` type, markdown parser/serializer, and file-system operations.
- Core business logic: hook into `updateTask` to detect milestone-level trigger conditions and cascade updates to the parent milestone.
- CLI: `milestone create` and `milestone edit` flags (`--actual-start`, `--actual-end`, `--clear-actual-start`, `--clear-actual-end`).
- Server API: milestone create/update handlers.
- Web UI: milestone detail/edit forms with `datetime-local` inputs, following the same UTC-storage/local-display convention established in BACK-492 (via `storedUtcToDateTimeLocal` / `dateTimeLocalToStoredUtc`).
- MCP: milestone schemas and handlers.
- i18n labels for all 4 locales.
- Tests and agent guidelines.

**Out of scope for BACK-492:**
- This work is intentionally deferred to a follow-up task so that BACK-492 can ship task-level actual dates first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Milestones support optional `actualStart` and `actualEnd` end-to-end: types, create/edit flows, markdown frontmatter persistence, and load/save parsing.
- [ ] #2 When a task under a milestone transitions to an in-progress status, the milestone's `actualStart` is auto-populated with current date-time if empty.
- [ ] #3 When all tasks under a milestone are in a terminal/Done status, the milestone's `actualEnd` is auto-populated with current date-time if empty.
- [ ] #4 CLI `milestone create` and `milestone edit` support `--actual-start`, `--actual-end`, `--clear-actual-start`, `--clear-actual-end`.
- [ ] #5 Web UI and server API support `actualStart` and `actualEnd` in milestone create / edit / view paths.
- [ ] #6 MCP milestone schemas and handlers support `actualStart` and `actualEnd`.
- [ ] #7 i18n labels added for all 4 locales (en, ja, zh-CN, zh-TW).
- [ ] #8 Web UI `datetime-local` inputs correctly convert between stored UTC values and local timezone display, consistent with task-level `actualStart`/`actualEnd` behavior.
- [ ] #9 Agent guidelines updated to mention milestone actual date fields.
- [ ] #10 The two fields are optional; absence must not break existing milestones or frontmatter files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:IMPLEMENTATION_PLAN:BEGIN -->
1. Extend `Milestone` type and milestone markdown parser/serializer with `actual_start`/`actual_end` frontmatter fields.
2. Add milestone auto-population logic in `updateTask`: when a task under a milestone transitions to in-progress, set milestone `actualStart` if empty; when the last non-terminal task under a milestone becomes terminal, set milestone `actualEnd` if empty.
3. Add CLI flags (`--actual-start`, `--actual-end`, `--clear-actual-start`, `--clear-actual-end`) to `milestone create` and `milestone edit`.
4. Extend server API and MCP milestone handlers.
5. Add Web UI `datetime-local` inputs for milestones, reusing `storedUtcToDateTimeLocal`/`dateTimeLocalToStoredUtc` from BACK-492 for timezone consistency.
6. Add i18n labels, update agent guidelines, and write tests.
<!-- SECTION:IMPLEMENTATION_PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
_(Deferred to implementation phase.)_
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
