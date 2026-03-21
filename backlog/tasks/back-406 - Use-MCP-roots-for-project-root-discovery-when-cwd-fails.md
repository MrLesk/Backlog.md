---
id: BACK-406
title: Use MCP roots for project root discovery when cwd fails
status: In Progress
assignee:
  - '@claude'
created_date: '2026-03-21 11:12'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When AI agent harnesses launch `backlog mcp start`, they sometimes don't set `process.cwd()` to the user's project directory. If neither `--cwd` nor `BACKLOG_CWD` is provided, the server falls back to `process.cwd()`, which could be wrong, causing the server to start in fallback/init-required mode.

The MCP protocol has a first-class `roots` capability where clients tell servers about their workspace directories. After the initialization handshake, the server can call `listRoots()` to get `file://` URIs for the client's workspace roots.

This task adds roots-based project root discovery as a recovery mechanism when the initial cwd resolution fails to find a backlog project. Also bumps `@modelcontextprotocol/sdk` from 1.26.0 to latest.

**Resolution priority chain:**
1. `--cwd` flag (explicit override) — trusted
2. `BACKLOG_CWD` env var — trusted
3. `process.cwd()` — may be wrong
4. **MCP roots from client** (new) — recovery when 1-3 fail
5. Fallback mode if nothing works

**Architecture:**
- Roots are only available after the MCP initialization handshake completes (`oninitialized` callback)
- When in fallback mode (no config found), the server queries client roots to find a valid backlog project
- A readiness gate (promise) ensures tool/resource handlers wait for roots resolution before proceeding
- `Core.fs` and `Core.git` readonly modifiers are relaxed to support reinitialization with a new project root

**Key files:**
- `src/core/backlog.ts` — Core class, needs reinitializeProjectRoot()
- `src/mcp/server.ts` — McpServer class, roots discovery logic
- `src/commands/mcp.ts` — MCP start command
- `src/utils/runtime-cwd.ts` — existing cwd resolution
- `src/utils/find-backlog-root.ts` — backlog root discovery
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When the MCP server starts in fallback mode (no backlog config found via cwd), it queries client roots after initialization and reinitializes with the correct project root if found
- [ ] #2 The readiness gate prevents tool/resource handlers from executing before roots resolution completes
- [ ] #3 The existing resolution priority (--cwd > BACKLOG_CWD > process.cwd()) is preserved and takes precedence over roots
- [ ] #4 Roots discovery is only triggered when initial resolution fails — no added latency for the happy path
- [ ] #5 @modelcontextprotocol/sdk is bumped to the latest version (1.27.1+)
- [ ] #6 Existing MCP server tests continue to pass
- [ ] #7 New test coverage for roots-based resolution
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
