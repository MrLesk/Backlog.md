---
id: BACK-643
title: Add a project task attribute for monorepo backlogs
status: Done
assignee:
  - '@claude'
created_date: '2026-08-20 16:20'
updated_date: '2026-08-29 18:13'
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
1. BACK-643.2: --project not added to standalone 'draft create' (it has neither --priority nor --type either).
2. BACK-643.3/.4: MCP task_list/task_search project filtering moved from the mutation slice to the filtering slice, matching BACK-355's actual commit split.
3. BACK-643.4: GET /api/tasks gets no project param (task type has zero HTTP filtering there today -- confirmed by grep, not assumed); GET /api/search does, since it has real filtering infra.
4. BACK-643.6: Web UI project support scoped to Board/BoardPage/TaskCard/TaskDetailsModal only -- TaskList.tsx and DraftsList.tsx have zero task-type support today (confirmed via source), so project doesn't add filtering there either.

Final verification after all 6 subtasks landed: bunx tsc --noEmit clean, bun run check . clean (391 files), bun run build succeeds, and the FULL project test suite (bun run test) passes: 2394 pass / 6 skip (pre-existing interactive-PTY skips, unrelated) / 0 fail across 2400 tests in 250 files. One pre-existing test (cli-json-output.test.ts) needed updating for the new project: null field in the compact JSON envelope -- fixed and verified (separate commit).

Manual end-to-end smoke test in two scratch repos (not just automated tests): confirmed --project fails closed with a clear message on an unconfigured repo; confirmed 'projects:' in config.yml is picked up by config get projects; confirmed task create --project validates and rejects invalid values with the exact valid-values list; confirmed task list --project and --project a,b (OR) filter correctly; confirmed project: appears in frontmatter in the correct position (after type:, before ordinal:); confirmed task edit --project '' clears the field and stamps updated_date; confirmed search --project works; confirmed --help text and config get projects correctly show 'no projects configured' messaging on a second, unconfigured scratch repo, and that --project there fails closed with the same message as the CLI validator.

Committed as 4 commits on tasks/back-637-multiproject-attribute: e5772ae (slices .1-.4), 02020dc (.5 TUI), 3ab7c73 (.6 Web UI), 21ef2d7 (JSON test fix). Branch not yet pushed or merged -- that's the user's call.

Addressed Codex PR review (PR #924): wired --project through search/list type-scoping and the interactive view's filter+loader; hasCreateFieldFlags/hasEditFieldFlags now recognize --project; centralized the 'No projects configured' message on the resolved config path; web UI can now clear project on edit end-to-end (server handlers were previously silently discarding it); project badges (web + TUI) now hide when no projects are configured; moved the TUI project filter picker off g/G to stop colliding with detail-pane scroll shortcuts.

Rebased onto upstream main (which had advanced with BACK-626/BACK-638, touching overlapping files) to resolve real merge conflicts reported by GitHub; resolved two import-ordering conflicts in content-store.ts and file-system/operations.ts, retested clean.

Maintainer takeover review (PR #924): renumbered this task and its six subtasks from BACK-637, which is owned by a different task in this repo (blank lines in fenced code blocks, PR #933); 641 and 642 were also taken. Dropped the coordination-only 'rebase this branch' task that shipped in the PR -- process state, not product history, and it collided with BACK-641.

Fixes applied on top of the contributor's work:
- Web: the task modal sent project in the edit-mode Save payload while the project select only renders when projects are configured. Saving a task in a repo with no projects:, or one whose stored project had left the config list, re-sent a value the form never showed -- clearing the field or failing the entire save. Now sent from the create form only, matching how type already behaves; the sidebar select persists edits immediately. Added an accessible name and a '(not configured)' option to match the type select.
- TUI: Down from Type skipped Priority in the stacked compact layout because the project override was unconditional. Board badges and the quick-look popup received the raw config array instead of the normalized list, so blank config entries would still render badges after the filter control had correctly disappeared. The footer never advertised the V project filter that the help popup listed; it is now derived from the same condition that binds the key.
- CLI: 'config get projects' printed prose where every sibling list key prints a value; it now prints the joined list, and --help points at the config file.
- Docs: documented projects: in ADVANCED-CONFIG.md (the only way to enable the feature, since like statuses/labels/types/priorities it cannot be set via 'config set'), and corrected the CLI-INSTRUCTIONS claim that project is null without configured projects.

Verified per interface: CLI (interactive, --plain, --json) create/edit/clear/list/search with case-insensitive canonicalization and OR filtering; MCP over real stdio JSON-RPC (schemas carry the enum when configured and omit the property entirely when not, so passing project is a clean validation error); web API (search filter, PUT set/clear/invalid -> 400) and the rendered board (badges, filter select); TUI board captured in a pty with and without projects configured.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a validated, single-valued 'project' task attribute for monorepo backlogs, following the exact six-slice pattern of the prior BACK-355 task-type feature: core domain model + frontmatter persistence + config projects: list (BACK-643.1), CLI --project on create/edit/list/search + config get + completions + help text (BACK-643.2), MCP task_create/task_edit (BACK-643.3), project-based filtering across Core/ContentStore/FileSystem/SearchService/task-search plus MCP task_list/task_search and GET /api/search (BACK-643.4), TUI board/list badges, filter control, and task composer (BACK-643.5), and Web UI Board/TaskCard/TaskDetailsModal (BACK-643.6).

Unlike priority and type, projects has no default value, so the feature is fail-closed by design: with no 'projects:' configured, --project errors clearly and every project UI element (badge, filter control, MCP schema field, TUI keyboard shortcut, task composer row) is entirely absent, verified in dedicated tests and a manual scratch-repo smoke test on both a configured and an unconfigured repo.

During implementation, four scope assumptions in the original task descriptions were corrected against verified source evidence rather than followed as written (draft create, MCP filtering slice placement, the /api/tasks vs /api/search split, and Web UI's actual footprint excluding TaskList/DraftsList) -- each correction is recorded on its subtask with the evidence that drove it.

Verified: bunx tsc --noEmit clean, bun run check . clean (391 files), bun run build succeeds, and the full project test suite passes -- 2394 pass / 6 pre-existing skips / 0 fail across 2400 tests in 250 files (one pre-existing test needed a fixture update for the new project: null JSON field, fixed separately). Also manually smoke-tested the built CLI end-to-end in two scratch repositories covering the fail-closed path, filtering, clearing, and frontmatter shape.
<!-- SECTION:FINAL_SUMMARY:END -->
