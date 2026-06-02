---
id: BACK-401
title: >-
  Add dueDate, plannedStart, and plannedEnd support for tasks and milestones
  across CLI, TUI, Web, and MCP
status: Done
assignee:
  - '@codex'
created_date: '2026-03-01 20:56'
updated_date: '2026-05-25 15:28'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/551'
  - >-
    backlog/wiki_output/reports/community-driven-feature-enhancement-recommendations.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce optional date fields for tasks and milestones and expose them consistently across all user surfaces:

- **`dueDate`** — deadline / last day the task must be completed (single point in time, rigid).
- **`plannedStart`** — estimated start of work (single point in time, flexible).
- **`plannedEnd`** — estimated end of work (single point in time, flexible).

All three fields are independent and may coexist on the same task or milestone (e.g. `plannedStart=2026-06-01`, `plannedEnd=2026-06-15`, `dueDate=2026-06-20`).

Keep the field names strictly as `dueDate`, `plannedStart`, and `plannedEnd` (no aliases). Date parsing reuses the existing `normalizeDate` infrastructure, but storage semantics differ from `createdDate`:
- **`createdDate`** is stored as date-time (`YYYY-MM-DD HH:MM`, UTC) because it records an exact moment.
- **`dueDate`**, **`plannedStart`**, and **`plannedEnd`** are stored as **date-only** (`YYYY-MM-DD`) because they represent calendar days, not exact moments.

The project's `normalizeDate` helper already supports both formats (it returns `YYYY-MM-DD` for midnight UTC values and `YYYY-MM-DD HH:MM` otherwise), so the parser can be reused. However, the write path must ensure these three fields are persisted as plain dates without time components.

**Web UI auto-fill rule:** When a user sets or updates `dueDate` in the Web UI and `plannedStart` is empty, the UI should automatically set `plannedStart` to the current calendar date and `plannedEnd` to the value of `dueDate`. This provides a sensible default planning window without requiring the user to manually fill all three fields. The user may still override these auto-filled values before saving.

**Board date indicators:** Task cards display a calendar icon with the planned date range (`plannedStart~plannedEnd`) in the header, and a clock icon with `dueDate` in the footer next to the creation time. Year is omitted when it matches the current year. Overdue due dates are rendered in red when the task is not in a terminal status.

**Milestone editing:** The CLI `milestone edit` command and MCP `milestone_edit` tool support updating title, description, and all three date fields. Pass an empty string to clear a date. The MCP tool was renamed from `milestone_rename` to reflect this broader capability.

**Agent guidelines updated:** `src/guidelines/agent-guidelines.md` now includes milestone management instructions and date field CLI commands so future agents know these fields exist.

**Out of scope for this task:** Gantt timeline view. The date fields are foundational data-layer work; a separate task will introduce a Gantt page once these fields are in place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tasks support optional `dueDate` end-to-end: types, create/edit flows, markdown frontmatter persistence, and load/save parsing.
- [x] #2 Tasks support optional `plannedStart` and `plannedEnd` end-to-end: types, create/edit flows, markdown frontmatter persistence, and load/save parsing (shared date infrastructure with `dueDate`).
- [x] #3 Milestones support optional `dueDate`, `plannedStart`, and `plannedEnd` end-to-end: types, milestone file persistence / parsing, and list / create / update flows where applicable.
- [x] #4 CLI plain and interactive task surfaces include the three date fields where task details / listing are shown, and task create / edit accepts date input (options or interactive prompts).
- [x] #5 Web UI and server API support all three date fields for tasks and milestones in create / edit / list / view paths.
- [x] #5a Web UI auto-fill rule: if `plannedStart` is empty when the user sets `dueDate`, automatically populate `plannedStart` with the current date and `plannedEnd` with `dueDate` (user can override before save).
- [x] #6 MCP task and milestone schemas / handlers support all three date fields (strict names, no aliases) and return them in task / milestone outputs.
- [x] #7 Automated tests cover parsing / serialisation for all three fields and at least one path each for CLI, web / server, and MCP.
- [x] #8 The three fields are optional; absence must not break existing tasks, milestones, or frontmatter files.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Completed changes

**Types (`src/types/index.ts`)**
- Added `dueDate?: string`, `plannedStart?: string`, `plannedEnd?: string` to `Task`, `TaskCreateInput`, `TaskUpdateInput`, and `Milestone`.

**Markdown layer (`src/markdown/parser.ts`, `src/markdown/serializer.ts`)**
- `parseTask` / `parseMilestone` read `due_date`, `planned_start`, `planned_end` from frontmatter.
- `serializeTask` writes the three fields.
- Added `serializeMilestone` helper; preserves `rawContent` (e.g. `## Notes`) instead of hard-coding only `## Description`.

**File system (`src/file-system/operations.ts`)**
- `createMilestone` and `updateMilestone` accept and persist date fields and description.
- Milestone serialization uses `serializeMilestone`.

**Core (`src/core/backlog.ts`)**
- `createTaskFromInput` passes date fields into new tasks.
- `applyTaskUpdateInput` supports updating / clearing date fields.
- `updateMilestone` supports title, description, and date updates; forwards to the file-system layer.

**CLI / TUI (`src/cli.ts`, `src/commands/task-wizard.ts`, `src/types/task-edit-args.ts`, `src/utils/task-edit-builder.ts`, `src/formatters/task-plain-text.ts`)**
- `task create` / `task edit` added `--due-date`, `--planned-start`, `--planned-end` and `--clear-*` options.
- `milestone edit` added with `--title`, `--description`, `--due-date`, `--planned-start`, `--planned-end`, and `--clear-*` options.
- Interactive wizard prompts for the three fields.
- `task view --plain` displays Due / Planned Start / Planned End.

**Server API (`src/server/index.ts`)**
- `handleCreateTask` / `handleUpdateTask` forward date fields.
- `handleCreateMilestone` / `handleUpdateMilestone` forward date fields.

**Web UI (`src/web/components/TaskDetailsModal.tsx`, `src/web/components/MilestonesPage.tsx`, `src/web/components/TaskCard.tsx`, `TaskColumn.tsx`, `Board.tsx`)**
- Task detail modal has three `<input type=\"date\">` fields in the sidebar.
- Auto-fill rule: when `dueDate` is set and `plannedStart` is empty, auto-fill `plannedStart = today` and `plannedEnd = dueDate`.
- Milestone create / edit modals have date inputs.
- Milestone cards display dates when present.
- Task cards show planned date range (calendar icon) in header and dueDate (clock icon) in footer.
- Overdue due dates render in red when task is not in terminal status.

**MCP (`src/mcp/utils/schema-generators.ts`, `src/mcp/tools/tasks/handlers.ts`, `src/mcp/tools/milestones/`)**
- `task_create` / `task_edit` JSON schemas include the three fields.
- `milestone_edit` (renamed from `milestone_rename`) supports title, description, and date updates; pass empty string to clear a date.
- Handlers pass fields through to core.

**i18n (`src/web/locales/en.ts`, `ja.ts`, `zh-CN.ts`, `zh-TW.ts`)**
- Added `dates`, `dueDate`, `plannedStart`, `plannedEnd` keys.

**Agent guidelines (`src/guidelines/agent-guidelines.md`, `src/guidelines/mcp/overview-tools.md`)**
- Added milestone management section with CLI and MCP usage.
- Added date field editing commands to the task modification table.

**Tests (`src/test/markdown.test.ts`, `src/test/mcp-milestones.test.ts`)**
- Added parse, serialize, and round-trip tests for date fields.
- All MCP milestone tests pass (32 pass, 0 fail).

**File-system / Core refactor (`src/file-system/operations.ts`, `src/core/backlog.ts`, `src/mcp/tools/milestones/handlers.ts`)**
- Renamed `renameMilestone` → `updateMilestone` to reflect that the method now updates date fields even when the title does not change.
- Fixed `MilestoneHandlers.editMilestone` (formerly `renameMilestone`) so that it no longer short-circuits with \"No changes made\" when only date fields are modified.
- Task milestone rewrites (`updateTasks`) are now skipped when the title itself has not changed, avoiding unnecessary file writes.

**Serializer fix (`src/markdown/serializer.ts`)**
- `serializeMilestone` now preserves `rawContent` (e.g. `## Notes` sections) instead of hard-coding only `## Description`.

**Board date indicators (`src/web/components/TaskCard.tsx`, `TaskColumn.tsx`, `Board.tsx`)**
- Task cards show a calendar icon + planned date range (`plannedStart~plannedEnd`) in the header; year is omitted when it matches the current year.
- Task cards show a clock icon + `dueDate` in the footer, next to the relative creation time.
- Overdue due dates are rendered in red (`text-red-600 dark:text-red-400 font-semibold`) when the task is not in a terminal status.
- `terminalStatus` is threaded from `Board` → `TaskColumn` → `TaskCard` to drive the overdue highlight logic.

### Verification
- `bunx tsc --noEmit` ✅
- `bun run check .` ✅ (pre-existing warnings only)
- `bun test src/test/markdown.test.ts src/test/mcp-milestones.test.ts` — 68 pass, 0 fail
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes when TypeScript touched
- [x] #2 `bun run check .` passes when formatting / linting touched
- [x] #3 `bun test` (or scoped test) passes
<!-- DOD:END -->
