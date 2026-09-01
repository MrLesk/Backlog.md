---
id: BACK-670
title: Remove the standalone task dependencies command and its TUI
status: To Do
assignee: []
created_date: '2026-09-01 06:27'
updated_date: '2026-09-01 06:27'
labels: []
dependencies: []
ordinal: 302000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task detail already carries the dependency graph on every surface (CLI plain, JSON, TUI, web, MCP) as the derived field added by BACK-548, so the per-task `backlog task dependencies` command shipped by BACK-641 is a second window onto data every surface already shows, minus the task itself. Its interactive view also contradicts its own footer, which reads [Enter/Click] Open task while Enter re-roots the graph. Remove the command, its interactive view (src/ui/dependencies-tui.ts), and the MCP task_dependencies tool, keeping the shared formatter refactor that BACK-641 introduced: the task viewer now renders through the same tree serializer as the plain output, and BACK-663 built on it. The shared label helper (formatDependencyNodeTuiLabel) and formatDependencyGraphEntries must survive the removal in a sensible home. Corpus-level exploration is BACK-671, which is the surface that earns a standalone view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog task dependencies is gone from the CLI, its help schema, and shipped agent instructions
- [ ] #2 The MCP task_dependencies tool is removed and no MCP surface references it
- [ ] #3 src/ui/dependencies-tui.ts is deleted and the shared label and entry helpers it held live in a home the task viewer and plain formatter both use
- [ ] #4 Task detail output on every surface still renders the dependency graph exactly as before, byte-identical in --plain
- [ ] #5 Tests covering the removed command are deleted and the remaining graph tests still pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
