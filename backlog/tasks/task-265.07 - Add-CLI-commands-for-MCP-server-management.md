---
id: task-265.07
title: Add CLI commands for MCP server management
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - cli
  - commands
dependencies: []
parent_task_id: task-265
---

## Description

Integrate MCP server functionality into the existing CLI by adding commands to start, stop, and configure the MCP server for agent connections.

### Implementation Details

**CLI Command Integration (`src/cli.ts`):**
```typescript
// Add to existing Command structure
program
  .command('mcp')
  .description('MCP server management commands')
  .addCommand(
    new Command('start')
      .description('Start MCP server')
      .option('-t, --transport <type>', 'Transport type (stdio|http)', 'stdio')
      .option('-p, --port <port>', 'HTTP port (when using HTTP transport)', '3000')
      .option('--host <host>', 'HTTP host (when using HTTP transport)', 'localhost')
      .action(async (options) => {
        await startMcpServer(options);
      })
  )
  .addCommand(
    new Command('stop')
      .description('Stop running MCP server')
      .action(async () => {
        await stopMcpServer();
      })
  )
  .addCommand(
    new Command('status')
      .description('Show MCP server status')
      .action(async () => {
        await getMcpServerStatus();
      })
  );
```

**Server Process Management:**

**1. Start Command Implementation:**
```typescript
async function startMcpServer(options: {
  transport: 'stdio' | 'http',
  port?: string,
  host?: string
}) {
  const core = new Core(process.cwd());
  const mcpServer = new McpServer(process.cwd());

  switch (options.transport) {
    case 'stdio':
      await mcpServer.initializeStdioTransport();
      break;
    case 'http':
      await mcpServer.initializeHttpTransport({
        port: parseInt(options.port || '3000'),
        host: options.host || 'localhost'
      });
      break;
  }

  console.error(`MCP server started with ${options.transport} transport`);
}
```

**2. Process Management:**
- Use PID file for tracking server process (`/tmp/backlog-mcp-server.pid`)
- Implement graceful shutdown on SIGINT/SIGTERM
- Handle process cleanup on exit
- Support daemon mode for HTTP transport

**3. Status Command:**
```typescript
async function getMcpServerStatus() {
  const pidFile = '/tmp/backlog-mcp-server.pid';
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
    try {
      process.kill(pid, 0); // Check if process exists
      console.log(`MCP server running (PID: ${pid})`);
    } catch {
      console.log('MCP server not running (stale PID file)');
      fs.unlinkSync(pidFile);
    }
  } else {
    console.log('MCP server not running');
  }
}
```

**Integration with Existing CLI Patterns:**
- Follow existing command structure and help text patterns
- Use consistent error handling and logging approaches
- Leverage existing Core class instantiation patterns
- Support existing configuration loading mechanisms

**Configuration Integration:**
- Add MCP-specific configuration options to BacklogConfig
- Support transport-specific settings
- Enable/disable MCP server via configuration
- Validate MCP configuration on startup

**Command Examples:**
```bash
# Start stdio transport (default)
backlog mcp start

# Start HTTP transport on custom port
backlog mcp start --transport http --port 8080

# Check server status
backlog mcp status

# Stop running server
backlog mcp stop
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] backlog mcp start command launches MCP server
- [ ] backlog mcp stop command terminates running server
- [ ] backlog mcp status command shows server state
- [ ] Commands integrate with existing CLI structure
- [ ] Server process management is robust
- [ ] Configuration options are exposed through CLI
<!-- AC:END -->
