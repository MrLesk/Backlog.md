---
id: BACK-605
title: Route all TUI operations through shared core with runtime cwd
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 16:23'
labels: []
dependencies: []
ordinal: 244000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TUI board handlers construct Core(process.cwd()) directly at multiple sites in src/ui/board.ts (file:line evidence in the BACK-581 review notes), bypassing resolveRuntimeCwd and BACKLOG_CWD. This is the same divergence family as issue #854 (init ignoring BACKLOG_CWD). Direction from Alex (2026-08-08): all interfaces must go through the same core logic; no interface builds its own Core from process.cwd(). Audit the TUI (and any other interface) for remaining direct Core(process.cwd()) construction and route everything through the shared instance or the shared runtime cwd resolver.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No TUI code constructs Core from process.cwd() directly; all handlers reuse the shared core instance or the shared runtime cwd resolver
- [x] #2 TUI operations honor BACKLOG_CWD end to end
- [x] #3 A repo-wide audit confirms no other interface constructs Core from process.cwd() outside the shared resolver, or aligns the stragglers
- [x] #4 Tests or recorded verification evidence cover the BACKLOG_CWD path in the TUI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one shared runtime-core factory next to Core: `createRuntimeCore(options?)` in src/core/backlog.ts, which builds a Core from `resolveRuntimeCwd()` (honours --cwd/BACKLOG_CWD, else process.cwd()). Single resolution path for every surface.
2. Thread the already-constructed Core into the board TUI: add `core?: Core` to renderBoardTui options; unified-view.ts, simple-unified-view.ts and enhanced-views.ts pass their existing `options.core`. Inside board.ts replace all 7 `new Core(process.cwd(), { enableWatchers: true })` sites (create, edit, complete x2, archive x2, reorder) with one closure that returns the passed instance, falling back to a memoised createRuntimeCore() only when no instance was supplied (tests call renderBoardTui directly).
3. Remove the remaining TUI cwd construction: src/ui/enhanced-views.ts uses the threaded core instead of `new Core(process.cwd())`; src/ui/task-viewer-with-search.ts fallback uses createRuntimeCore instead of `new Core(process.cwd(), ...)`.
4. Align non-TUI stragglers on the same factory: src/utils/task-path.ts (getTaskPath fallback), src/utils/status.ts (getValidStatuses fallback), src/completions/data-providers.ts (shell completion data). Audit and record the rest: web server (Core built from requireProjectRoot in cli.ts) and MCP (resolveRuntimeCwd in commands/mcp.ts) are already resolver-based; src/server/index.ts process.cwd() is asset-dir chdir bookkeeping, src/readme.ts writes README relative to process.cwd() (output path, not project resolution).
5. Tests: unit-test createRuntimeCore honouring BACKLOG_CWD and falling back to process.cwd(); TUI test that presses 'n' with a stub composer that calls the default `persist`, once with BACKLOG_CWD pointing at a fixture (task lands in the fixture while process.cwd() is elsewhere) and once with an explicit core for a second fixture (task lands there, proving the passed instance is reused).
6. Verify: grep -rn "Core(process.cwd" src/ is empty, bunx tsc --noEmit, bun run check ., bun run test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

Added one shared resolution path and threaded the existing Core through the TUI.

- `createRuntimeCore(options?)` (src/core/backlog.ts, exported next to `Core`) builds a Core from `resolveRuntimeCwd()`, so `--cwd`/`BACKLOG_CWD` (else `process.cwd()`) is honoured in exactly one place. It fails closed when the override points at a missing directory, matching the CLI entry points.
- src/ui/board.ts: `renderBoardTui` takes `core?: Core` and all seven handlers (create, edit, complete x2, archive x2, reorder) now call a single `getCore()` closure that returns the caller's instance, memoising a `createRuntimeCore({ enableWatchers: true })` fallback only when no instance was supplied (tests call renderBoardTui directly). Previously each handler built `new Core(process.cwd(), { enableWatchers: true })`.
- src/ui/unified-view.ts, src/ui/simple-unified-view.ts and src/ui/enhanced-views.ts pass the Core they already hold; enhanced-views no longer builds its own from `process.cwd()`.
- src/ui/task-viewer-with-search.ts fallback uses `createRuntimeCore` instead of `new Core(process.cwd(), ...)`.

Notable side effect of threading the instance: the board previously bound mutations to `process.cwd()` while rendering from the project root resolved by `requireProjectRoot()`. That diverged not only under BACKLOG_CWD but also whenever the TUI was launched from a subdirectory. Board mutations now share the Core the task viewer already used, so all TUI surfaces read one project root and the board stops creating throwaway watcher-enabled Cores per keypress.

## Interface audit (repo-wide)

Aligned on the shared resolver:
- src/utils/task-path.ts `getTaskPath` optional-core fallback.
- src/utils/status.ts `getValidStatuses` optional-core fallback.
- src/completions/data-providers.ts shell-completion data provider (dropped its local `createCore`).

Already resolver-based, unchanged:
- Web server: `new BacklogServer(cwd)` at src/cli.ts:5230 with `cwd` from `requireProjectRoot()` -> `requireRuntimeCwd()` -> `resolveRuntimeCwd()`.
- MCP: `createMcpServer(runtimeCwd.cwd)` from src/commands/mcp.ts, which calls `resolveRuntimeCwd({ cwd: options.cwd })`.
- Every `new Core(cwd)` in src/cli.ts takes `cwd` from `requireProjectRoot()`/`requireRuntimeCwd()`.

Remaining `process.cwd()` uses that are not project resolution and were left alone:
- src/server/index.ts:483 saves/restores the process cwd around the bundled-asset `chdir`; it never builds a Core.
- src/readme.ts writes README.md and a temp board file relative to `process.cwd()` (output path, a separate concern from project resolution).
- src/commands/help-schema.ts:183 resolves an output directory override for schema generation.

## Verification

- `grep -rn "Core(process.cwd" src/` -> no matches (exit 1).
- `bunx tsc --noEmit` clean; `bun run check .` clean (367 files); `bun run test` -> 2065 pass, 6 skip, 0 fail across 223 files.
- New src/test/tui-runtime-cwd.test.ts drives the board's `n` handler through its own `persist` with process.cwd() pointed at an unrelated directory: one case asserts the task lands in BACKLOG_CWD, the other asserts a supplied Core instance wins over BACKLOG_CWD. Both fail against the pre-change board.ts (`Expected length: 1 / Received length: 0`) and pass after.
- src/test/runtime-cwd.test.ts covers `createRuntimeCore` for the process.cwd() default, the BACKLOG_CWD override, and the invalid-override rejection.
- PTY verification of a real mutation: cwd = this repo worktree (a different Backlog project), BACKLOG_CWD = a /tmp fixture project holding one task. `expect` spawned `bun src/cli.ts board`, the window title rendered as "Fixture Project - Board" with the fixture's TASK-1, then `a` + Enter produced the "Archived TASK-1" footer and moved `backlog/tasks/task-1 - Second-fixture-task.md` into the fixture's `backlog/archive/tasks/`. The same script against the pre-change board.ts timed out waiting for the footer and left the file in `backlog/tasks/`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routed every TUI mutation through the Core instance its caller already holds, with a single `createRuntimeCore()` factory (resolveRuntimeCwd, so --cwd/BACKLOG_CWD then process.cwd()) as the only remaining construction path. All seven board.ts handlers, enhanced-views and the task-viewer fallback no longer build `new Core(process.cwd())`; the same factory now covers the getTaskPath/getValidStatuses fallbacks and the shell-completion provider. Web server and MCP were already resolver-based and unchanged. Verified with `grep -rn 'Core(process.cwd' src/` (no matches), new src/test/tui-runtime-cwd.test.ts plus createRuntimeCore cases in src/test/runtime-cwd.test.ts (both new suites fail against the pre-change board.ts), a PTY run where BACKLOG_CWD archived a fixture task while cwd sat in a different Backlog project, and clean bunx tsc --noEmit, bun run check ., bun run test (2065 pass / 6 skip / 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
