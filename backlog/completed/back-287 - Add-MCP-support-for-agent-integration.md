---
id: BACK-287
title: Add MCP support for agent integration
status: Done
assignee:
  - '@codex'
created_date: '2025-09-13 18:52'
updated_date: '2025-10-11 20:07'
labels:
  - mcp
  - integration
  - agent
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Model Context Protocol (MCP) support to expose backlog.md functionality to AI agents through a standardized protocol. Enables agents (Claude Code, Claude Desktop, Google Gemini CLI, OpenAI Codex) to manage tasks, projects, and documentation through MCP tools, resources, and prompts.

## Architecture

MCP server extends Core class, providing:
- **30+ Tools**: CLI parity (tasks, drafts, docs, notes, board, config, dependencies, sequences)
- **10+ Resources**: Read-only data access (tasks, board state, metrics, docs)
- **Transport**: stdio-only (recommended; safest for local assistants)
- **CLI Command**: `backlog mcp start`

## Key Principles

✅ Pure protocol wrapper - zero business logic in MCP layer
✅ Core API usage - all operations via existing Core methods
✅ Localhost-only - runtime validation prevents network exposure
✅ Shared utilities - task-builders, validators used by CLI and MCP
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP server extends Core class with stdio transport
- [x] #2 33+ MCP tools provide complete CLI feature parity
- [x] #3 10+ MCP resources for read-only data access
- [x] #4 CLI command group exposes setup, security, and start workflows
- [x] #5 Localhost-only security with runtime enforcement
- [x] #6 Comprehensive test coverage (full suite passing)
- [x] #7 Complete documentation (architecture, security, setup)
- [x] #8 Architecture compliance verified (pure wrapper, Core API usage)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## ✅ Implementation Complete

**Branch**: user/radleta/mcp-support
**Status**: Production-ready after stdio-only simplification

### Deliverables

- MCP server (`src/mcp/server.ts`) extends `Core`, exposes 30+ tools and 10 resources via stdio transport
- CLI command group now exposes `backlog mcp start`

### Security & Architecture

- Stdio transport is the single supported execution path (no HTTP/SSE endpoints)
- Runtime behaviour remains local-only; no network sockets are opened
- MCP layer continues to be a pure protocol wrapper over existing Core APIs

### Quality Validation

- `BUN_TEST_TIMEOUT=120000 bun test --test-concurrency=1` (full suite) – green
- TypeScript compilation and Biome formatting checks pass
- No new runtime dependencies introduced

### Notes

- All HTTP/SSE transport files, connection manager, PID management, and associated tests have been removed
- MCP CLI commands trimmed accordingly; references to `stop`, `status`, `test`, and `doctor` were dropped across docs/tests
- Task 285 description/ACs updated to describe the stdio-only architecture
<!-- SECTION:NOTES:END -->
