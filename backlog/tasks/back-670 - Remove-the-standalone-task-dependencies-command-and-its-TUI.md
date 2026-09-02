---
id: BACK-670
title: Remove the standalone task dependencies command and its TUI
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-01 06:27'
updated_date: '2026-09-02 18:44'
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
- [x] #1 backlog task dependencies is gone from the CLI, its help schema, and shipped agent instructions
- [x] #2 The MCP task_dependencies tool is removed and no MCP surface references it
- [x] #3 src/ui/dependencies-tui.ts is deleted and the shared label and entry helpers it held live in a home the task viewer and plain formatter both use
- [x] #4 Task detail output on every surface still renders the dependency graph exactly as before, byte-identical in --plain
- [x] #5 Tests covering the removed command are deleted and the remaining graph tests still pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Capture baseline: build a scratch project covering chains, diamonds, cycles, unknown/ambiguous IDs and completed deps, and record 'task view --plain' plus '--json' for every task, to diff after the removal.
2. Move formatDependencyNodeTuiLabel and its private escapeBlessedTags helper out of src/ui/dependencies-tui.ts into src/formatters/dependency-graph-text.ts, next to the plain formatDependencyNodeLabel they share wording with; repoint the task viewer import and delete src/ui/dependencies-tui.ts.
3. Remove the CLI 'task dependencies' command: the addHelpSchema block and action in src/cli.ts, the runTaskDependenciesTui/taskDependenciesJson/formatTaskDependenciesPlainText imports, the 'dependencies' entry in the taskCmd --json allowlist, and the now-unused taskDependenciesJson (json-output.ts) and formatTaskDependenciesPlainText (task-plain-text.ts).
4. Remove the MCP task_dependencies tool: taskDependenciesSchema, the TaskHandlers.taskDependencies handler, the tool definition, its addTool registration, and the schema re-export.
5. Drop the command and tool from shipped instructions: cli-instructions/task-execution.md, mcp/overview.md, mcp/overview-tools.md, mcp/task-execution.md.
6. Delete src/test/cli-task-dependencies.test.ts, relocating only the two surviving shared-helper tests (graph entries carry node refs; TUI label colors and escapes) into src/test/dependency-graph.test.ts; drop task_dependencies from the two mcp-server.test.ts tool-list expectations.
7. Re-capture the scratch project output and diff it against the baseline, then run bunx tsc --noEmit, bun run check . and bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the standalone read and kept the shared serializer.

Deleted: the `backlog task dependencies` CLI command with its help schema and its entry in the taskCmd --json allowlist (src/cli.ts, -44); src/ui/dependencies-tui.ts (-220); the MCP task_dependencies tool, handler and schema (src/mcp/tools/tasks/{index,handlers,schemas}.ts, -46); the now-unused taskDependenciesJson (json-output.ts) and formatTaskDependenciesPlainText (task-plain-text.ts); the four shipped instruction references (cli-instructions/task-execution.md, mcp/overview.md, mcp/overview-tools.md, mcp/task-execution.md); and src/test/cli-task-dependencies.test.ts (-302). Net 57 insertions / 643 deletions outside the task record.

Kept: formatDependencyGraphEntries already lived in src/formatters/dependency-graph-text.ts and did not move. formatDependencyNodeTuiLabel and its private escapeBlessedTags helper moved there verbatim, next to the plain formatDependencyNodeLabel whose wording they reuse, so the plain and colored labels cannot drift apart. Its only consumer, src/ui/task-viewer-with-search.ts, already imported formatDependencyGraphLines from that module, so the move removed an import rather than adding one. The two tests from the deleted file that cover surviving code (entries pair each task line with its node; the TUI label colors unresolved/completed nodes and escapes braces) moved into the existing 'dependency graph text' block in src/test/dependency-graph.test.ts.

Verified byte-identical task detail output: built a scratch project covering a chain, a diamond with a (shown above) repeat, a cycle, an unknown ID, an ambiguous ID, a completed dependency and an isolated task, then captured 'task view <id> --plain', 'task view <id> --json', 'task <id> --plain' for all ten resolvable tasks plus 'task list --plain', 'task edit 4 --plain' and 'doctor' before and after the change against the same project directory. diff reports no difference: 1635 lines / 41749 bytes, md5 96872cbb0374cd5e19a7112e320b68d7 on both sides. The snapshot was also proven stable across two consecutive pre-change runs, so the diff measures the code change and not run-to-run noise.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the standalone `backlog task dependencies` command, its interactive TUI (src/ui/dependencies-tui.ts) and the MCP task_dependencies tool, together with the CLI help schema entry, the --json allowlist entry, the now-unused taskDependenciesJson and formatTaskDependenciesPlainText formatters, the four shipped CLI/MCP instruction references and the command's test file: a second window onto the dependency graph every surface already renders on the task detail. The shared serializer stayed: formatDependencyGraphEntries was already in src/formatters/dependency-graph-text.ts, and formatDependencyNodeTuiLabel moved there verbatim beside the plain label it wraps, so the task viewer now takes both from one module. Net 57 insertions against 643 deletions outside the task record. Verified with a before/after snapshot of a scratch project covering chains, diamonds, cycles, unknown and ambiguous IDs, a completed dependency and an isolated task across 'task view --plain', '--json', 'task <id> --plain', 'task list --plain', 'task edit --plain' and 'doctor' - diff reports no difference (1635 lines, 41749 bytes, identical md5), with the TUI and web graph sections still covered by src/test/dependency-graph-surfaces.test.tsx and src/test/web-dependency-graph-section.test.tsx. bunx tsc --noEmit and bun run check . pass; bun run test reports 2846 pass / 0 fail with the known local-only content-store.test.ts flake, which also appears on unmodified origin/main and passes when that file is run on its own.
<!-- SECTION:FINAL_SUMMARY:END -->
