---
id: BACK-354
title: Project Definition of Done defaults
status: Done
assignee:
  - '@codex'
created_date: '2025-12-28 20:34'
updated_date: '2026-01-18 13:28'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce project-level Definition of Done defaults that are inherited by tasks and visible across interfaces, with per-task override support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project config supports a Definition of Done list (e.g., `definition_of_done` in `backlog/config.yml`) that seeds new tasks by default and can be overridden, extended, or disabled per task.
- [x] #2 Users can edit DoD defaults via the Web UI Settings page.

- [x] #3 DoD checklists are visible and trackable in CLI, MCP, Web UI, and TUI task views.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan (approved by user):
1) Core + config (BACK-354.01): add `definition_of_done` to `BacklogConfig`, parse/serialize in `src/file-system/operations.ts`, and expose in config list where appropriate. Add task-level `definitionOfDoneItems` (same shape as AC) in `src/types/index.ts`, `TaskCreateInput`, and `TaskUpdateInput`.
2) Markdown persistence: follow AC logic (markers + parsing/serialization). Add "Definition of Done" to `src/markdown/section-titles.ts`. Implement DoD checklist handling in `src/markdown/structured-sections.ts` with `<!-- DOD:BEGIN/END -->` markers. Parse in `src/markdown/parser.ts`, serialize in `src/markdown/serializer.ts`.
3) Create behavior: apply config defaults unless `disableDefinitionOfDoneDefaults` is true; append any `definitionOfDoneAdd` items. No replace/overwrite behavior.
4) Update behavior: only add/remove/check/uncheck DoD items (no replace-all). Implement in `src/core/backlog.ts` alongside AC logic.
5) CLI + MCP (BACK-354.02):
   - CLI create: `--dod <item>` (add), `--no-dod-defaults` (disable defaults).
   - CLI edit: `--dod <item>` (add), `--remove-dod <index>`, `--check-dod <index>`, `--uncheck-dod <index>`.
   - MCP fields: create `definitionOfDoneAdd`, `disableDefinitionOfDoneDefaults`; edit `definitionOfDoneAdd`, `definitionOfDoneRemove`, `definitionOfDoneCheck`, `definitionOfDoneUncheck`.
   - Update `src/types/task-edit-args.ts`, `src/utils/task-edit-builder.ts`, `src/formatters/task-plain-text.ts`, and MCP tool schema/handlers.
6) Web UI (BACK-354.05 + BACK-354.03):
   - Settings: add editable DoD defaults list (order preserved) in `src/web/components/Settings.tsx` using `/api/config`.
   - Task modal: reuse `AcceptanceCriteriaEditor` for DoD section shown below AC; create flow pre-fills defaults, allows add items and optionally clear defaults (disable), no replace-all.
   - Server: accept DoD fields in `handleCreateTask`/`handleUpdateTask` in `src/server/index.ts`.
7) TUI (BACK-354.04): render DoD section in task detail + popup in `src/ui/task-viewer-with-search.ts` using checklist formatting.
8) Tests: add/extend tests for config parsing/serialization, markdown DoD persistence, core create/update behavior, CLI/MCP DoD flows; update any TUI render tests. Web UI: document manual verification steps.

Docs update scope (user approved): update README with Definition of Done defaults setup + CLI flags; update agent-guidelines for DoD CLI usage; update MCP guidelines (overview, overview-tools, task-creation, task-finalization) to include DoD fields and require DoD items checked before Done. No changes to backlog/docs/readme.md or backlog/tasks/readme.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Docs updated: README (DoD defaults setup + CLI flags), agent-guidelines (DoD CLI usage), MCP guides (overview, overview-tools, task-creation, task-finalization) to include DoD fields and completion requirements.
<!-- SECTION:NOTES:END -->
