---
id: BACK-493
title: Add actualStart and actualEnd support for milestones
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-28 01:55'
updated_date: '2026-05-28 05:42'
labels: []
dependencies:
  - BACK-492
priority: medium
actual_start: '2026-05-28 04:00'
actual_end: '2026-05-28 05:42'
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
- [x] #1 Milestones support optional `actualStart` and `actualEnd` end-to-end: types, create/edit flows, markdown frontmatter persistence, and load/save parsing.
- [x] #2 When a task under a milestone transitions to an in-progress status, the milestone's `actualStart` is auto-populated with current date-time if empty.
- [x] #3 When all tasks under a milestone are in a terminal/Done status, the milestone's `actualEnd` is auto-populated with current date-time if empty.
- [x] #4 CLI `milestone create` and `milestone edit` support `--actual-start`, `--actual-end`, `--clear-actual-start`, `--clear-actual-end`.
- [x] #5 Web UI and server API support `actualStart` and `actualEnd` in milestone create / edit / view paths.
- [x] #6 MCP milestone schemas and handlers support `actualStart` and `actualEnd`.
- [x] #7 i18n labels added for all 4 locales (en, ja, zh-CN, zh-TW).
- [x] #8 Web UI `datetime-local` inputs correctly convert between stored UTC values and local timezone display, consistent with task-level `actualStart`/`actualEnd` behavior.
- [x] #9 Agent guidelines updated to mention milestone actual date fields.
- [x] #10 The two fields are optional; absence must not break existing milestones or frontmatter files.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:IMPLEMENTATION_PLAN:BEGIN -->
1. Extend `Milestone` type and milestone markdown parser/serializer with `actual_start`/`actual_end` frontmatter fields.
2. Add milestone auto-population logic in `updateTask`: when a task under a milestone transitions to in-progress, set milestone `actualStart` if empty; when the last non-terminal task under a milestone becomes terminal, set milestone `actualEnd` if empty.
3. Add `milestone create` CLI command and extend `milestone edit` with `--actual-start`, `--actual-end`, `--clear-actual-start`, `--clear-actual-end` flags.
4. Extend server API (`handleCreateMilestone`, `handleUpdateMilestone`) and Web UI API client.
5. Add Web UI `datetime-local` inputs for milestones, reusing `storedUtcToDateTimeLocal`/`dateTimeLocalToStoredUtc` from BACK-492 for timezone consistency.
6. Extend MCP milestone schemas and handlers; rename tool reference from `milestone_rename` to `milestone_edit` in hints, docs, and tests.
7. Update agent guidelines to clarify that task-only milestone references do not create milestone files.
<!-- SECTION:IMPLEMENTATION_PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- The CLI `milestone create` command did not exist before BACK-493; it was added to match the AC requirement for create-side date flags.
- MCP tool name references (`milestone_rename` → `milestone_edit`) were updated in handler hints, agent guidelines, and `mcp-server.test.ts` to align with the actual registered tool name.
- Milestone auto-population in `updateTask` uses `milestoneKey()` for case-insensitive matching between task milestone values and milestone IDs/titles.
- When checking if all milestone tasks are terminal, `listTasks()` is called after saving the current task, so the current task's new terminal status is already reflected.
- No new i18n labels were needed; `taskDetails.section.actualStart` / `actualEnd` from BACK-492 are reused for milestone modals.
- Web UI `datetime-local` inputs follow the same UTC-storage/local-display convention as task `actualStart`/`actualEnd`.
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
