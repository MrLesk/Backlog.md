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

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] MCP server can be started via CLI command
- [ ] AI agents can create and update tasks through MCP tools
- [ ] Task data is accessible through MCP resources
- [ ] MCP prompts provide workflow templates for agents
- [ ] Both stdio and HTTP transports are supported
- [ ] Configuration integrates with existing backlog.md config system
<!-- AC:END -->
