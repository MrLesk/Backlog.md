---
id: BACK-641
title: Add `backlog task dependencies` command with TUI and plain graph views
status: Done
assignee:
  - '@claude'
created_date: '2026-08-29 17:53'
updated_date: '2026-08-31 20:04'
labels:
  - cli
  - tui
  - mcp
  - dependencies
dependencies:
  - BACK-548
references:
  - 'https://mdx-graphs.kshv.me/docs/graph-tree'
  - 'https://mdx-graphs.kshv.me/docs/graph-gantt'
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give users and agents a dedicated view of a task's dependency graph from the terminal. Interactive use opens a TUI graph; `--plain` prints deterministic text for agents and scripts; MCP exposes the same view. The graph semantics, traversal, and fail-closed identity rules come from the shared model defined by BACK-548; this command is a presentation surface over that model. Web graph exploration is tracked separately in BACK-553.

Visual direction (maintainer-suggested, not binding): borrow the ASCII visual language of mdx-graphs (MIT, references below) rather than the library itself, which is React/MDX and unusable in the TUI. Its graph-tree branch glyphs suit the blocked-by/blocks chains; its graph-gantt shade-glyph bars with progress fill could render the graph as work order (bar position from dependency depth, since tasks have no dates; fill from acceptance-criteria progress). Whether the gantt-style view ships is an implementation-plan decision for review, not a committed requirement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running `backlog task dependencies <id>` in a TTY opens a TUI view showing the upstream blocked-by graph and downstream dependents of the task, with direct vs transitive relationships distinguishable
- [x] #2 `--plain` prints a deterministic text rendering of the same graph, and `--json` exposes the normalized graph representation defined by BACK-548
- [x] #3 MCP exposes the same dependency-graph view for a task with content equivalent to the `--plain` output
- [x] #4 Missing references, ambiguous identities, and cycles are rendered explicitly and fail closed; the view never invents edges or reports unresolved relationships as resolved
- [x] #5 CLI help and shipped agent instructions document the command, its flags, and edge-direction semantics
- [x] #6 Automated tests cover chains, branches, diamonds, cycles, and unresolved IDs across TUI snapshot or render checks, plain, json, and MCP outputs
- [x] #7 Tasks shown in the TUI graph are mouse-clickable: clicking one switches the view to that task, alongside the keyboard navigation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend src/formatters/dependency-graph-text.ts with an entry-level serializer (formatDependencyGraphEntries) that returns { text, node } per line; keep formatDependencyGraphLines/Section as thin wrappers so plain, TUI, and the new command all share one tree layout.
2. Add a shared formatTaskDependenciesPlainText(task: TaskDetail) built on the same serializer: header line plus the exact graph block from task view --plain, or a one-line 'no dependencies and no dependents' message for isolated tasks.
3. CLI: add 'backlog task dependencies <id>' with --plain/--json via getTaskReadOutputMode; --json prints schemaVersion'd { kind: task-dependencies, task summary refs, dependencyGraph { root, nodes, edges } } reusing the graph shape from taskViewJson; extend the taskCmd preSubcommand --json allowlist; add help schema documenting edge-direction semantics.
4. TUI (default in TTY): new src/ui/dependencies-tui.ts using createScreen + a blessed list whose rows are the shared serializer entries (headings unselectable, node rows selectable); up/down/j/k move between task rows, Enter and single mouse click re-root the view on the selected resolved task (unresolved/cycle rows do not navigate), Esc/q exit; labels colored via the existing formatDependencyNodeTuiLabel idiom with {open}/{close} escaping.
5. MCP: add read-only task_dependencies tool ({ id }) next to task_view in src/mcp/tools/tasks, returning the shared plain serializer text.
6. Docs: document the command in CLI help schema and add a line to cli-instructions/task-execution.md and mcp/task-execution.md pointing at the dedicated dependencies view.
7. Tests: serializer entries mapping; CLI --plain/--json for chains, branches, diamonds, cycles, unresolved/ambiguous IDs, isolated tasks; MCP tool output equivalence with --plain; no absolute dates.
8. Gates: bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: new 'backlog task dependencies <id>' command consumes the existing TaskDetail derived graph (loadTaskDetail/loadTaskCorpus + withDependencyGraph) - no new computation path, loader, or endpoint.

- src/formatters/dependency-graph-text.ts: internals refactored to build { text, node } entries; formatDependencyGraphEntries exported for the interactive view; formatDependencyGraphLines/Section unchanged in output, so plain, TUI detail, and the new command all share the one tree serializer.
- src/formatters/task-plain-text.ts: extracted formatDependencyGraphBlock (used by formatTaskPlainText unchanged) and added formatTaskDependenciesPlainText - title line plus the identical task-view graph block, or the one-line 'has no dependencies and no dependents.' message.
- src/formatters/json-output.ts: taskDependenciesJson ({ schemaVersion: 1, kind: 'task-dependencies', dependencyGraph: { root, nodes, edges } }) via a shared toDependencyGraphJson also used by task view JSON.
- src/cli.ts: 'task dependencies <taskId>' with --plain/--json (help schema documents edge-direction semantics; taskCmd --json allowlist extended); same local-only task lookup as task view; interactive default runs the TUI.
- src/ui/dependencies-tui.ts: blessed list rendering the shared serializer entries; up/down/j/k move between task rows (headings/separators skipped, wheel/heading clicks snap to nearest task row); Enter or single mouse click re-roots the view on the selected task; unresolved (missing/ambiguous) nodes are shown but never followed; cycle/repeat markers come from the shared serializer; {open}/{close} escaping via the shared formatDependencyNodeTuiLabel, which task-viewer-with-search now imports instead of keeping a private copy. Corpus loaded once per session; each re-root is withDependencyGraph over the same corpus, resolved via createTaskRecordIndex (same fail-closed identity rules).
- src/mcp: read-only task_dependencies tool ({ id }) registered next to task_view; returns formatTaskDependenciesPlainText output, byte-identical to CLI --plain.
- Docs: cli-instructions/task-execution.md, mcp/task-execution.md, mcp/overview.md, mcp/overview-tools.md mention the command/tool and edge-direction semantics.

Notable finding: neo-neo-bblessed 1.0.10 never activates its lazy mouse parser for the screen's own 'mouse' listener registration (program.bindMouse() is never called), so clicks were dead; the view calls program.bindMouse() explicitly (idempotent). The same latent issue likely affects every mouse:true TUI view - flagged as follow-up for Alex, not expanded here.

Verification: bunx tsc --noEmit clean; bun run check . clean; bun run test 2798 pass / 0 fail. New tests in src/test/cli-task-dependencies.test.ts (CLI plain/json: chain both directions, diamond, cycle, missing+ambiguous fail-closed, isolated one-liner, --json+--plain rejection, missing task exit 1; serializer entry/node mapping incl. blessed-tag escaping; MCP tool output equality with CLI --plain, isolated + missing cases); mcp-server.test.ts tool lists updated. Interactive TUI manually verified via expect PTY harness (sized pty): render, Enter re-root, j/k movement, mouse click re-root (X10 sequences), q exit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added 'backlog task dependencies <id>': an interactive TUI graph view by default (arrow/j/k navigation, Enter or mouse click re-roots on the selected task, Esc/q exits), '--plain' printing the identical graph block task view renders through the one shared serializer, '--json' exposing the BACK-548 normalized graph (root/nodes/edges) as kind 'task-dependencies', and a read-only MCP task_dependencies tool whose text equals the CLI --plain output byte-for-byte. The command consumes the existing TaskDetail derived graph (loadTaskCorpus/withDependencyGraph) with no new computation path; unresolved and cyclic references render exactly as everywhere else and are never navigated into; an isolated task prints a one-line message. CLI help schema and the shipped CLI/MCP instruction guides document the command and edge-direction semantics. Verified with bunx tsc --noEmit, bun run check ., bun run test (2798 pass / 0 fail) including new src/test/cli-task-dependencies.test.ts covering chains, diamonds, cycles, missing/ambiguous IDs, isolated tasks, JSON shape, and MCP/CLI equivalence, plus manual expect/PTY verification of TUI rendering, keyboard navigation, mouse-click navigation, and exit.
<!-- SECTION:FINAL_SUMMARY:END -->
