---
id: BACK-605
title: Route all TUI operations through shared core with runtime cwd
status: In Progress
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 16:04'
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
- [ ] #1 No TUI code constructs Core from process.cwd() directly; all handlers reuse the shared core instance or the shared runtime cwd resolver
- [ ] #2 TUI operations honor BACKLOG_CWD end to end
- [ ] #3 A repo-wide audit confirms no other interface constructs Core from process.cwd() outside the shared resolver, or aligns the stragglers
- [ ] #4 Tests or recorded verification evidence cover the BACKLOG_CWD path in the TUI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
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
