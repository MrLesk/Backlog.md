---
id: task-265
title: Add MCP support for agent integration
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - integration
  - agent
dependencies: []
priority: high
---

## Description

Implement Model Context Protocol (MCP) support to expose backlog.md functionality directly to AI agents through a standardized protocol. This enables agents to interact with tasks, manage projects, and access documentation through MCP tools, resources, and prompts using stdio and HTTP transports.

### Technical Context
MCP is a protocol that allows AI agents to access external data sources and tools through a standardized interface. This implementation will:

- **Extend Core Class**: Build MCP server on top of existing `Core` class (`src/core/backlog.ts`) to leverage existing task management, configuration, and file operations
- **SDK Integration**: Use `@modelcontextprotocol/sdk` TypeScript library for protocol implementation
- **Dual Transport**: Support stdio (local) and HTTP/SSE (network) transports for different agent connection scenarios
- **Configuration Integration**: Extend `BacklogConfig` interface (`src/types/index.ts:76-98`) with MCP-specific settings

### Architecture Overview
```
/src/mcp/
├── server.ts          # Main MCP server extending Core
├── tools/             # MCP tool implementations (task CRUD, board ops)
├── resources/         # MCP resource handlers (data access)
├── prompts/           # MCP prompt templates (workflows)
└── transports/        # stdio and HTTP transport handlers
```

The implementation will expose:
- **Tools**: Actions agents can perform (create/update/list tasks, view board, manage config)
- **Resources**: Read-only data access (task details, board state, configuration)
- **Prompts**: Structured templates for common workflows (task creation, planning)

### Integration Points
- CLI commands via `src/cli.ts` (add `backlog mcp start/stop/status`)
- Configuration system integration for MCP settings
- Existing task management workflow compatibility
- Security and validation leveraging existing patterns

## Implementation Progress

### Completed Work
- **Dual-Mode Installation Detection**: Created `src/utils/installation-detector.ts` with intelligent detection for development vs global installations
- **MCP Wrapper Script**: Implemented `scripts/mcp-server.cjs` following project CommonJS distribution standards
- **Claude Code Configuration**: Created `.mcp.json` with proper Claude Code integration using wrapper script pattern
- **Non-Interactive Testing**: Built comprehensive test helpers in `src/test/mcp-test-helpers.ts` to avoid CLI prompt issues
- **Documentation Framework**: Established comprehensive MCP documentation structure (needs accuracy updates)

### Approach Changes
- **Claude Code First**: Shifted from generic agent support to Claude Code-first implementation for faster validation
- **Script Standards**: Changed from TypeScript scripts to CommonJS wrapper pattern for npm distribution compatibility
- **Testing Strategy**: Moved from CLI-based testing to programmatic helpers due to interactive command limitations

### Current Status
- Basic MCP infrastructure is in place and testable
- Wrapper script intelligently handles both development and global installation modes
- Claude Code configuration ready for testing
- Documentation needs updates to reflect wrapper script approach

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] Dual-mode installation detection system implemented
- [x] MCP wrapper script following project standards created
- [x] Claude Code configuration files generated
- [x] Non-interactive testing infrastructure built
- [ ] MCP server can be started via CLI command (partially - needs CLI integration)
- [ ] AI agents can create and update tasks through MCP tools (needs MCP server implementation)
- [ ] Task data is accessible through MCP resources (needs MCP server implementation)
- [ ] MCP prompts provide workflow templates for agents (needs MCP server implementation)
- [ ] Both stdio and HTTP transports are supported (stdio ready, HTTP pending)
- [ ] Configuration integrates with existing backlog.md config system (pending task-265.11)
<!-- AC:END -->
