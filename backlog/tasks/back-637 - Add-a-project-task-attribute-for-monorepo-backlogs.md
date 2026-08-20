---
id: BACK-637
title: Add a project task attribute for monorepo backlogs
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:20'
updated_date: '2026-08-20 18:09'
labels: []
dependencies: []
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md resolves exactly one project root per Core instance and has no way to distinguish which package/component within a monorepo a task belongs to. Teams either split into one backlog/ directory per package (duplicated config, split ID space, no cross-package board) or abuse free-form labels, which are never validated against config.labels and have inconsistent AND/OR semantics across CLI/MCP/HTTP. Add a validated, single-valued 'project' task attribute (frontmatter project:, CLI --project, config projects: list) alongside priority and type, following the exact precedent set by the BACK-355 task-type feature (six-slice rollout: core/persistence, CLI, MCP, filtering, TUI, web). Unlike type, projects has no sensible default value, so it must fail closed: with no projects configured, --project errors and the field is invisible in every surface (no badge, no filter control, no MCP enum).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task frontmatter supports an optional project: field, validated against config projects: when configured
- [x] #2 backlog/config.yml supports a projects: list, hand-edited like types: and priorities: today (config get projects works; config set projects is blocked with the same message as its siblings)
- [x] #3 With no projects configured, --project fails closed with a clear message and the project UI (badge, filter, MCP enum) is invisible everywhere
- [x] #4 backlog task create/edit --project validates against configured projects and can be cleared with --project "", matching type's clear semantics, not priority's
- [x] #5 backlog task list, search, and MCP task_list support project filtering with multi-value OR semantics, matching --type
- [x] #6 CLI/MCP guideline docs (CLI-INSTRUCTIONS.md, src/guidelines/*) document the project field and filter
- [x] #7 No changes to project-root resolution, ID allocation/prefixing, or backlog/ directory layout
- [x] #8 Tests cover round-trip persistence, unconfigured/invalid rejection, filtering, and clearing
- [x] #9 TUI board and list view, and Web UI board/task-cards/task-detail, show a project badge and filter control when projects are configured. Web UI's TaskList.tsx and DraftsList.tsx are intentionally excluded, matching --type's real footprint there (confirmed via source: neither has any task-type badge or filter support today either).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All 6 subtasks (.1-.6) completed sequentially, each with its own plan, notes, and finalization. Scope was corrected against verified source evidence at four points during execution, each recorded on the relevant subtask:
1. BACK-637.2: --project not added to standalone 'draft create' (it has neither --priority nor --type either).
2. BACK-637.3/.4: MCP task_list/task_search project filtering moved from the mutation slice to the filtering slice, matching BACK-355's actual commit split.
3. BACK-637.4: GET /api/tasks gets no project param (task type has zero HTTP filtering there today -- confirmed by grep, not assumed); GET /api/search does, since it has real filtering infra.
4. BACK-637.6: Web UI project support scoped to Board/BoardPage/TaskCard/TaskDetailsModal only -- TaskList.tsx and DraftsList.tsx have zero task-type support today (confirmed via source), so project doesn't add filtering there either.

Final verification after all 6 subtasks landed: bunx tsc --noEmit clean, bun run check . clean (391 files), bun run build succeeds, and the FULL project test suite (bun run test) passes: 2394 pass / 6 skip (pre-existing interactive-PTY skips, unrelated) / 0 fail across 2400 tests in 250 files. One pre-existing test (cli-json-output.test.ts) needed updating for the new project: null field in the compact JSON envelope -- fixed and verified (separate commit).

Manual end-to-end smoke test in two scratch repos (not just automated tests): confirmed --project fails closed with a clear message on an unconfigured repo; confirmed 'projects:' in config.yml is picked up by config get projects; confirmed task create --project validates and rejects invalid values with the exact valid-values list; confirmed task list --project and --project a,b (OR) filter correctly; confirmed project: appears in frontmatter in the correct position (after type:, before ordinal:); confirmed task edit --project '' clears the field and stamps updated_date; confirmed search --project works; confirmed --help text and config get projects correctly show 'no projects configured' messaging on a second, unconfigured scratch repo, and that --project there fails closed with the same message as the CLI validator.

Committed as 4 commits on tasks/back-637-multiproject-attribute: e5772ae (slices .1-.4), 02020dc (.5 TUI), 3ab7c73 (.6 Web UI), 21ef2d7 (JSON test fix). Branch not yet pushed or merged -- that's the user's call.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a validated, single-valued 'project' task attribute for monorepo backlogs, following the exact six-slice pattern of the prior BACK-355 task-type feature: core domain model + frontmatter persistence + config projects: list (BACK-637.1), CLI --project on create/edit/list/search + config get + completions + help text (BACK-637.2), MCP task_create/task_edit (BACK-637.3), project-based filtering across Core/ContentStore/FileSystem/SearchService/task-search plus MCP task_list/task_search and GET /api/search (BACK-637.4), TUI board/list badges, filter control, and task composer (BACK-637.5), and Web UI Board/TaskCard/TaskDetailsModal (BACK-637.6).

Unlike priority and type, projects has no default value, so the feature is fail-closed by design: with no 'projects:' configured, --project errors clearly and every project UI element (badge, filter control, MCP schema field, TUI keyboard shortcut, task composer row) is entirely absent, verified in dedicated tests and a manual scratch-repo smoke test on both a configured and an unconfigured repo.

During implementation, four scope assumptions in the original task descriptions were corrected against verified source evidence rather than followed as written (draft create, MCP filtering slice placement, the /api/tasks vs /api/search split, and Web UI's actual footprint excluding TaskList/DraftsList) -- each correction is recorded on its subtask with the evidence that drove it.

Verified: bunx tsc --noEmit clean, bun run check . clean (391 files), bun run build succeeds, and the full project test suite passes -- 2394 pass / 6 pre-existing skips / 0 fail across 2400 tests in 250 files (one pre-existing test needed a fixture update for the new project: null JSON field, fixed separately). Also manually smoke-tested the built CLI end-to-end in two scratch repositories covering the fail-closed path, filtering, clearing, and frontmatter shape.
<!-- SECTION:FINAL_SUMMARY:END -->
