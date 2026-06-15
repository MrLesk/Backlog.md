---
id: BACK-558
title: Resolve MCP project root from client workspace roots
status: Done
assignee:
  - '@ycaptain'
created_date: '2026-06-14 06:58'
updated_date: '2026-06-15 17:04'
labels:
  - mcp
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The MCP server resolves its project root once at startup and only consults MCP roots in fallback mode, so a shared/user-scope server (or one launched in the main checkout while working in a git worktree) writes tasks to the wrong backlog directory. See #558. Extend the request-scoped MCP roots discovery introduced in #608 (BACK-434) to the normal (initialized) startup path so the server follows the client's workspace roots, while preserving explicit pins (--cwd/BACKLOG_CWD) and the behavior of clients without the roots capability.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 An unpinned shared/user-scope server resolves the project from the client's workspace roots instead of a frozen startup directory, and re-resolves on roots/list_changed.
- [x] #2 An explicit --cwd/BACKLOG_CWD pin keeps a fixed root and never queries client roots.
- [x] #3 When the client workspace has no backlog project (empty/unusable roots, or a folder without a backlog), an unpinned launch-directory project is kept rather than dropped to init-required; pin with --cwd/BACKLOG_CWD to target a fixed global backlog.
- [x] #4 Clients without the roots capability keep the previous process.cwd() behavior, and the constraints from #570 are preserved (each root checked directly, multi-root selects the first advertised root that has a backlog config, single-flight).
- [x] #5 Tests cover the git-worktree case from #558, the shared-server case, pin precedence, the nested monorepo case, and the no-roots fallback; the full suite passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Thread a pinned flag from src/commands/mcp.ts into createMcpServer, derived from whether the directory came from --cwd/BACKLOG_CWD or process.cwd().
2. Enable the existing request-scoped roots discovery on the normal (initialized) startup path too — gated by pinned — reusing upgradeToProject/downgradeToFallback/resolveFromRoots from #608 rather than rewriting the resolver.
3. Track startupHasProject so a normal baseline keeps its project when the client workspace has no backlog (only a fallback/init-required baseline downgrades); make upgradeToProject's no-op short-circuit cover the normal baseline.
4. Keep the #570 constraints (each root checked directly, multi-root first-with-config, single-flight).
5. Cover cases in src/test/mcp-workspace-root.test.ts; update mcp-roots-discovery.test.ts for the confirm-once behavior; update the README MCP section.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Minimal patch on top of #608's request-scoped roots discovery — upgradeToProject/downgradeToFallback/resolveFromRoots are kept intact rather than rewriting the resolver.

- src/mcp/server.ts: the normal (initialized) startup path now also calls enableRootsDiscovery unless pinned; a startupHasProject flag makes a normal baseline keep its project when the client workspace has no backlog (only a fallback baseline reverts to init-required); upgradeToProject's no-op short-circuit covers the normal baseline so a client root equal to the launch dir does not re-register.
- src/commands/mcp.ts threads pinned from --cwd/BACKLOG_CWD vs process.cwd().
- Scope: this PR intentionally does NOT drop an unrelated launch project (e.g. a global ~/.backlog) or add monorepo-nesting rules; those were left out to keep it a minimal bugfix within the existing architecture. Pin with --cwd/BACKLOG_CWD to fix a global backlog.
- Behavior change (reviewer note): the normal/initialized path now issues one roots/list request to follow the client workspace (#608 issued none in normal mode); a pin opts out entirely.

Full suite passes; bun run check . and bunx tsc --noEmit clean.

<!-- SECTION:NOTES:END -->
