---
id: BACK-492
title: Add actualStart and actualEnd fields for tasks with auto-population on status change
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-28 01:15'
updated_date: '2026-05-28 02:55'
labels: []
dependencies: []

references: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce optional `actualStart` and `actualEnd` date fields for tasks to track when work actually began and finished.

**Auto-population rules:**
- When a task's status changes to an in-progress status (e.g., "In Progress"), if `actualStart` is empty, it is automatically set to the current date-time.
- When a task's status changes to a terminal/Done status, if `actualEnd` is empty, it is automatically set to the current date-time.

Users can manually override these values via CLI commands and Web UI.

**Storage semantics:**
- `actualStart` and `actualEnd` are stored as **date-time** (`YYYY-MM-DD HH:MM`, UTC) in frontmatter, same format as `createdDate`.

**Scope:**
- Add fields to **task** types, markdown parser/serializer, core business logic, CLI, Web UI, server API, MCP tools, i18n, tests, and agent guidelines.
- Milestone support is intentionally out of scope for this task; see dependency [[BACK-493]].
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Tasks support optional `actualStart` and `actualEnd` end-to-end: types, create/edit flows, markdown frontmatter persistence, and load/save parsing.
- [x] #2 Status change auto-population: when transitioning to an in-progress status, `actualStart` is set to current date-time if empty. When transitioning to a terminal/Done status, `actualEnd` is set to current date-time if empty.
- [x] #3 CLI supports `--actual-start`, `--actual-end`, `--clear-actual-start`, `--clear-actual-end` flags on task create and edit commands.
- [x] #4 Web UI and server API support `actualStart` and `actualEnd` in create / edit / view paths.
- [x] #5 MCP task schemas and handlers support `actualStart` and `actualEnd`.
- [x] #6 i18n labels added for all 4 locales (en, ja, zh-CN, zh-TW).
- [x] #7 Plain text formatter displays `actualStart` and `actualEnd` where applicable.
- [x] #8 Agent guidelines updated to mention the new fields.
- [x] #9 The two fields are optional; absence must not break existing tasks or frontmatter files.
<!-- AC:END -->

## Related Tasks

- [[BACK-493]] — Milestone-level `actualStart` / `actualEnd` support (deferred follow-up).

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Successfully implemented `actualStart` and `actualEnd` fields across all 12 layers of the Backlog.md surface stack.

**Key decisions:**
- Storage format follows `createdDate` convention (`YYYY-MM-DD HH:MM`, UTC) rather than the date-only format used by `plannedStart`/`plannedEnd`. This provides minute-level precision for tracking real work timestamps.
- Auto-population uses `isInProgressStatus()` (case-insensitive match on "inprogress") and `isTerminalStatus()` (last configured status) to determine trigger conditions.
- Auto-population only fires when the field is empty, respecting any user-provided override.
- Web UI uses `datetime-local` inputs for `actualStart`/`actualEnd` while keeping `date` inputs for `plannedStart`/`plannedEnd`/`dueDate`.
- Web UI datetime-local inputs correctly convert between stored UTC values and local timezone display, ensuring `actualStart`/`actualEnd` appear consistent with `createdDate` in the UI.

**Files modified (20):**
- `src/types/index.ts` — added to Task, TaskCreateInput, TaskUpdateInput
- `src/types/task-edit-args.ts` — added to TaskEditArgs
- `src/markdown/parser.ts` — parse `actual_start`/`actual_end` from frontmatter
- `src/markdown/serializer.ts` — serialize to frontmatter
- `src/core/backlog.ts` — auto-populate on status change + pass-through in create/edit
- `src/utils/status.ts` — added `isInProgressStatus()` helper
- `src/utils/task-edit-builder.ts` — map CLI args to update input
- `src/cli.ts` — added flags for create/edit + wired into create handler
- `src/formatters/task-plain-text.ts` — display fields in `--plain` output
- `src/server/index.ts` — API create/update handlers
- `src/mcp/tools/tasks/handlers.ts` — create handler passes new fields
- `src/mcp/utils/schema-generators.ts` — JSON schema for MCP tools
- `src/web/components/TaskDetailsModal.tsx` — form inputs with datetime-local
- `src/web/locales/{en,ja,zh-CN,zh-TW}.ts` — i18n labels
- `src/commands/task-wizard.ts` — wizard support for new fields
- `src/guidelines/agent-guidelines.md` — updated example frontmatter
- `src/web/utils/date-display.ts` — added `storedUtcToDateTimeLocal` / `dateTimeLocalToStoredUtc` helpers for timezone-aware datetime-local binding
- `src/web/utils/date-display.test.ts` — unit tests for UTC ↔ local conversion helpers

**Verification:**
- `bunx tsc --noEmit` ✅
- `bun test src/test/markdown.test.ts` ✅ 36/36 passed
- `bun test src/web/utils/date-display.test.ts` ✅ 15/15 passed
- CLI end-to-end: To Do → In Progress auto-filled `actualStart`; In Progress → Done auto-filled `actualEnd` ✅
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
