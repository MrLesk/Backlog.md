---
id: BACK-374
title: Ensure MCP server exits when stdio closes and disposes watchers
status: Done
assignee:
  - '@codex'
created_date: '2026-01-23 04:01'
updated_date: '2026-01-23 04:22'
labels: []
dependencies: []
references:
  - src/commands/mcp.ts
  - src/mcp/server.ts
  - src/core/content-store.ts
  - src/core/backlog.ts
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users report the Backlog.md MCP process staying alive after Codex/Claude Code closes. The MCP stdio server should shut down promptly when its parent closes the stdio pipes, and it should release filesystem watchers so the event loop can exit. The goal is to avoid orphaned MCP processes without requiring manual kills.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the MCP client closes stdio (no SIGTERM/SIGINT), the MCP process exits cleanly without lingering in the process list.
- [x] #2 Shutdown path disposes filesystem watchers and search resources created by the MCP server so the event loop can exit.
- [x] #3 No regression for normal SIGINT/SIGTERM shutdown; the server still stops cleanly.
- [x] #4 Add or update automated coverage to simulate stdio close and assert the process exits (or document why test coverage is not feasible).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add MCP shutdown hooks for stdio close/EPIPE/SIGHUP in `src/commands/mcp.ts` with idempotent shutdown.
2. Ensure `McpServer.stop()` disposes search/content resources to close filesystem watchers in `src/mcp/server.ts`.
3. Add integration test to spawn `backlog mcp start --debug`, close stdin, and assert clean exit in `src/test/mcp-stdio-exit.test.ts` (skip on Windows).
4. Run targeted test `bun test src/test/mcp-stdio-exit.test.ts` and fix any regressions if needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Drafted code changes and added the test file locally; waiting for approval to proceed with any further adjustments or test runs.

Ran: `bun run check .`, `bunx tsc --noEmit`, `bun test src/test/mcp-stdio-exit.test.ts` (after installing deps with `BUN_INSTALL_CACHE_DIR=/tmp/bun-cache-backlogmd bun i`).

Noted: initial `bun run check .` failed due to missing biome; `bunx tsc --noEmit` needed escalated tempdir access.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:
- Added MCP stdio shutdown handling (stdin end/close, EPIPE, SIGHUP/SIGPIPE) with idempotent shutdown.
- Made `McpServer.stop()` dispose search/content stores to release filesystem watchers.
- Added integration test that spawns `backlog mcp start --debug`, closes stdin, and asserts clean exit (skips Windows).

Tests:
- bun run check .
- bunx tsc --noEmit
- bun test src/test/mcp-stdio-exit.test.ts

Notes:
- PR: https://github.com/MrLesk/Backlog.md/pull/500
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
