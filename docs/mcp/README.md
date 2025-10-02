# MCP Integration

MCP (Model Context Protocol) enables AI assistants to interact with backlog.md.

## Quick Start

```bash
# View setup instructions for your AI assistant
backlog mcp setup

# View security guidelines
backlog mcp security

# Start the server
backlog mcp start
```

## Available Commands

- `backlog mcp setup` - Display setup instructions for all supported AI assistants
- `backlog mcp security` - Display security guidelines (localhost only!)
- `backlog mcp start` - Start MCP server (stdio/http/sse transport)
- `backlog mcp stop` - Stop running server
- `backlog mcp status` - Check server status
- `backlog mcp test` - Test MCP connection
- `backlog mcp doctor` - Diagnose configuration issues

## Development

MCP implementation: `/src/mcp/`
Tests: `bun test src/test/mcp-*.test.ts`

Tools are self-documenting via TypeScript schemas in `/src/mcp/tools/`.