---
id: task-265
title: Add MCP support for agent integration
status: Done
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-10-02 15:40'
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
- **33+ Tools**: Complete CLI parity (tasks, drafts, docs, notes, board, config, dependencies, sequences)
- **10+ Resources**: Read-only data access (tasks, board state, metrics, docs)
- **3 Transports**: stdio (recommended), HTTP, SSE (localhost-only with runtime enforcement)
- **7 CLI Commands**: setup, security, start, stop, status, test, doctor

## Key Principles

✅ Pure protocol wrapper - zero business logic in MCP layer
✅ Core API usage - all operations via existing Core methods
✅ Localhost-only - runtime validation prevents network exposure
✅ Shared utilities - task-builders, validators used by CLI and MCP
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP server extends Core class with stdio/HTTP/SSE transports
- [x] #2 33+ MCP tools provide complete CLI feature parity
- [x] #3 10+ MCP resources for read-only data access
- [x] #4 7 CLI commands for setup, control, and diagnostics
- [x] #5 Localhost-only security with runtime enforcement
- [x] #6 Comprehensive test coverage (1,067 tests, 100% pass rate)
- [x] #7 Complete documentation (architecture, security, setup)
- [x] #8 Architecture compliance verified (pure wrapper, Core API usage)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## ✅ Implementation Complete

**Branch**: user/radleta/mcp-support
**Commit**: 7c00591
**Status**: Production-ready, approved for merge

### Deliverables

**Code**:
- 104 files changed (+27,002 lines)
- 30 MCP source files in `src/mcp/`
- 25 test files (1,067 tests, 100% pass rate)
- 33+ tools, 10+ resources, 3 transports

**CLI Commands**:
```bash
backlog mcp setup|security|start|stop|status|test|doctor
```

**Documentation**:
- `docs/mcp/README.md` - Implementation overview
- `docs/mcp/SECURITY.md` - Security model & warnings
- Updated CLAUDE.md, DEVELOPMENT.md, README.md

### Quality Metrics

✅ **Tests**: 1,067/1,067 passing (100%)
✅ **TypeScript**: 0 errors
✅ **Code Quality**: Biome clean
✅ **Security**: Localhost enforcement verified
✅ **Architecture**: Core API compliance verified

### Key Features

**Tools (33+)**:
- Task lifecycle: create, list, update, view, archive, demote
- Drafts: create, list, view, promote, archive
- Documents & decisions: CRUD operations
- Notes & plans: set, append, get, clear
- Board & config: view, manage
- Dependencies & sequences: add, remove, validate, plan

**Resources (10+)**:
- tasks://list, tasks://by-status, tasks://by-label
- board://overview, config://current, metrics://summary
- Individual task access, archived tasks, docs

**Transports (3)**:
- stdio (recommended - max security)
- HTTP (localhost-only with runtime validation)
- SSE (localhost-only with streaming support)

### Security

Runtime enforcement prevents binding to 0.0.0.0 or public IPs. All network transports restricted to localhost (127.0.0.1, ::1) with token-based auth.

### Architecture Compliance

✅ Pure protocol wrapper (zero business logic)
✅ Core API usage (no direct fs/git operations)
✅ Shared utilities (task-builders, validators)
✅ Localhost-only security model

### Pre-Merge Validation

All completed 2025-10-02:
- ✅ Fixed 3 failing tests → 100% pass rate
- ✅ TypeScript compilation clean
- ✅ Biome quality checks passed
- ✅ Security audit (localhost enforcement added)
- ✅ Architecture audit (Core API usage verified)

**Ready for merge to main**
<!-- SECTION:NOTES:END -->
