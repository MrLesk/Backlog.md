---
id: BACK-409
title: 'Add Cursor to MCP initialization (CLI, web, core)'
status: Done
assignee: []
created_date: '2026-03-21 16:35'
updated_date: '2026-03-21 16:44'
labels:
  - init
  - mcp
  - cursor
dependencies: []
documentation:
  - src/core/init.ts
  - src/cli.ts
  - src/web/components/InitializationScreen.tsx
  - src/agent-instructions.ts
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users who pick MCP integration should see Cursor as an explicit option alongside other clients.

When Cursor is selected, the implementation should use Cursor’s current, documented project-level MCP mechanism to create or merge the Backlog MCP server entry where the runtime reliably supports it. If automation is not possible or is unreliable, the flow must degrade gracefully with clear user-visible feedback and a documented fallback (for example pointing to the setup guide).

Cursor must also follow the same pattern as other MCP clients that rely on AGENTS.md: ensure MCP workflow guidelines are present in AGENTS.md when Cursor is selected.

Relevant code areas: src/core/init.ts (MCP client loop), src/cli.ts (interactive MCP multiselect and handler), src/web/components/InitializationScreen.tsx and src/web/lib/api.ts (wizard + types), src/server/index.ts (init API). Tests: extend src/test/cli.test.ts and any init/server tests as appropriate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Core: initializeProject accepts a new MCP client id for Cursor; when selected, ensure AGENTS.md MCP guidelines via existing helpers and perform Cursor MCP config merge/create per current Cursor docs where supported, or set mcpResults with a clear success vs fallback message.
- [x] #2 CLI: Interactive MCP multiselect lists Cursor; document or align any non-interactive init path if applicable.
- [x] #3 Web: MCP step in the initialization wizard includes Cursor; API, types, and server validation accept the new client value end-to-end.
- [x] #4 Quality: Automated tests cover the new behavior; bun test and bunx tsc --noEmit pass for touched code.
- [x] #5 Docs/copy: Wizard text, CLI summary, or other user-facing init messaging reflects Cursor and matches actual fallback behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Cursor as an MCP client across core, CLI, and web init: `configureCursorProjectMcp` writes/merges `.cursor/mcp.json` (stdio `backlog mcp start`), with `mergeCursorMcpProjectJson` for unit tests and `BACKLOG_TEST_CURSOR_MCP_RELATIVE_DIR` only for sandbox-safe file tests. `initializeProject` runs Cursor setup plus `ensureMcpGuidelines` for AGENTS.md. CLI multiselect and MCP_CLIENT_INSTRUCTION_MAP include Cursor; web wizard and API types include `cursor`. Updated `src/guidelines/mcp/init-required.md`. Added `src/test/cursor-mcp-init.test.ts`. Verified with `bun test` on cursor + enhanced-init tests, `tsc --noEmit`, and Biome on touched files.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
