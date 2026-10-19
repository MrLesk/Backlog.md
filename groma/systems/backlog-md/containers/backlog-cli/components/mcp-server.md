---
type: C4 Component
title: MCP server
status: stable
groma:
  id: mcp-server
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/mcp/server.ts
    - scanner: typescript
      file: src/commands/mcp.ts
      symbol: registerMcpCommand
    - scanner: typescript
      file: src/mcp/types.ts
    - scanner: typescript
      file: src/mcp/errors/mcp-errors.ts
    - scanner: typescript
      file: src/mcp/validation/tool-wrapper.ts
    - scanner: typescript
      file: src/mcp/validation/validators.ts
    - scanner: typescript
      file: src/mcp/resources/init-required/index.ts
      symbol: registerInitRequiredResource
    - scanner: typescript
      file: src/mcp/resources/workflow/index.ts
      symbol: registerWorkflowResources
  group: MCP
  technology: MCP TypeScript SDK, stdio
description: Optional MCP adapter for AI clients, over stdio
---

Runs as `backlog mcp start`, launched by the AI client. It extends the core, finds the project from the client's MCP roots and follows workspace switches unless BACKLOG_CWD or --cwd pins it, and serves backlog://init-required until it finds an initialized project. It registers the tools and exposes the workflow guides as resources. MCP is an optional, legacy surface; the CLI stays canonical.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/mcp/server.ts](../../../../../../src/mcp/server.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Extends the core | Class inheritance |
| [src/mcp/server.ts](../../../../../../src/mcp/server.ts) | [src/mcp/tools/tasks/index.ts](../../../../../../src/mcp/tools/tasks/index.ts) | Registers tools | MCP SDK |
| [src/mcp/resources/workflow/index.ts](../../../../../../src/mcp/resources/workflow/index.ts) | [src/mcp/workflow-guides.ts](../../../../../../src/mcp/workflow-guides.ts) | Serves workflow guides | MCP resources |
