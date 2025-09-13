---
id: task-265.03
title: Implement stdio transport for local MCP connections
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - transport
  - stdio
  - tdd
dependencies: ['task-265.02']
parent_task_id: task-265
---

## Description

Implement stdio transport for MCP server enabling local AI agents to connect via stdin/stdout. Add basic CLI command for starting the server and update test infrastructure to support real transport testing.

### Implementation Details

**1. Server Transport Implementation (`/src/mcp/server.ts`):**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Core } from '../core/backlog.ts';

export class McpServer extends Core {
  private server: Server;
  private transport?: StdioServerTransport;

  constructor(projectRoot: string) {
    super(projectRoot);
    this.server = new Server({
      name: 'backlog-md-mcp',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    this.setupServerHandlers();
  }

  async startTransport(type: 'stdio' | 'http'): Promise<void> {
    if (type === 'stdio') {
      await this.startStdioTransport();
    } else {
      throw new Error('HTTP transport not implemented yet');
    }
  }

  private async startStdioTransport(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    console.error('MCP server running on stdio'); // Log to stderr
  }

  private setupServerHandlers(): void {
    // Tools list handler
    this.server.setRequestHandler('tools/list', async () => {
      return { tools: [] }; // Empty for now, will be populated in later tasks
    });

    // Initialize handler
    this.server.setRequestHandler('initialize', async (request) => {
      return {
        protocolVersion: '2024-11-05',
        capabilities: await this.getCapabilities(),
        serverInfo: {
          name: 'backlog-md-mcp',
          version: '1.0.0'
        }
      };
    });
  }
}
```

**2. Basic CLI Integration (`/src/cli.ts`):**
```typescript
// Add to existing CLI structure
import { McpServer } from './mcp/server.ts';

// Add MCP command to existing program
program
  .command('mcp')
  .description('MCP server management')
  .addCommand(
    new Command('start')
      .description('Start MCP server')
      .option('-t, --transport <type>', 'Transport type (stdio|http)', 'stdio')
      .action(async (options) => {
        try {
          const server = new McpServer(process.cwd());
          await server.startTransport(options.transport as 'stdio' | 'http');
        } catch (error) {
          console.error('Failed to start MCP server:', error.message);
          process.exit(1);
        }
      })
  );
```

**3. Enhanced Transport Test (`/src/mcp/__tests__/integration/stdio-transport.test.ts`):**
```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createMcpTestProject, cleanupTestProject } from '../test-utils.ts';

describe('MCP Stdio Transport Integration', () => {
  let projectPath: string;
  let serverProcess: ChildProcess | null = null;

  beforeEach(async () => {
    const project = await createMcpTestProject();
    projectPath = project.path;
  });

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    await cleanupTestProject(projectPath);
  });

  test('can start MCP server via CLI', async () => {
    serverProcess = spawn('backlog', ['mcp', 'start', '--transport', 'stdio'], {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(serverProcess.killed).toBe(false);
  });

  test('server responds to initialize request', async () => {
    serverProcess = spawn('backlog', ['mcp', 'start', '--transport', 'stdio'], {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send initialize request
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    serverProcess.stdin?.write(JSON.stringify(initMessage) + '\n');

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      let buffer = '';
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      serverProcess!.stdout?.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              if (message.id === 1) {
                clearTimeout(timeout);
                resolve(message.result);
              }
            } catch (error) {
              // Ignore parsing errors
            }
          }
        }
      });
    });

    expect(response).toHaveProperty('capabilities');
    expect(response).toHaveProperty('serverInfo');
  });
});
```

**Implementation Steps:**
1. **Update server to support stdio transport**
2. **Add basic CLI command integration**
3. **Create integration tests with real process spawning**
4. **Verify handshake protocol works correctly**

**Next Steps:**
- CLI command enables manual testing and real agent connections
- Transport tests verify protocol compliance
- Foundation ready for adding tools and resources

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Stdio transport implemented in McpServer
- [ ] CLI command `backlog mcp start` added and functional
- [ ] MCP initialize handshake working correctly
- [ ] JSON-RPC message handling functional
- [ ] Integration tests verify CLI and transport work together
- [ ] All tests pass: `bun test src/mcp/__tests__/integration/stdio-transport.test.ts`
- [ ] Manual verification: `backlog mcp start --transport stdio` starts successfully
<!-- AC:END -->
