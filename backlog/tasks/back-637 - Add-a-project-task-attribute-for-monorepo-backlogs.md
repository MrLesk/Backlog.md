---
id: BACK-637
title: Add a project task attribute for monorepo backlogs
status: To Do
assignee: []
created_date: '2026-08-20 16:20'
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
- [ ] #1 Task frontmatter supports an optional project: field, validated against config projects: when configured
- [ ] #2 backlog/config.yml supports a projects: list, hand-edited like types: and priorities: today (config get projects works; config set projects is blocked with the same message as its siblings)
- [ ] #3 With no projects configured, --project fails closed with a clear message and the project UI (badge, filter, MCP enum) is invisible everywhere
- [ ] #4 backlog task create/edit --project validates against configured projects and can be cleared with --project "", matching type's clear semantics, not priority's
- [ ] #5 backlog task list, search, and MCP task_list support project filtering with multi-value OR semantics, matching --type
- [ ] #6 TUI board/list and Web UI task list/board/detail show a project badge and filter control when projects are configured
- [ ] #7 CLI/MCP guideline docs (CLI-INSTRUCTIONS.md, src/guidelines/*) document the project field and filter
- [ ] #8 No changes to project-root resolution, ID allocation/prefixing, or backlog/ directory layout
- [ ] #9 Tests cover round-trip persistence, unconfigured/invalid rejection, filtering, and clearing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
