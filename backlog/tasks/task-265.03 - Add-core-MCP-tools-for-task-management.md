---
id: task-265.03
title: Add core MCP tools for task management
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-09-13 21:20'
labels:
  - mcp
  - tools
  - task-management
  - core
dependencies: ['task-265.02']
parent_task_id: task-265
---

## Description

Add core MCP tools for task management to the existing comprehensive MCP server infrastructure. Implement tools that allow AI agents to create, read, update, and list tasks through the MCP protocol.

**Foundation**: Builds on the comprehensive McpServer class from task-265.01 which includes handler Maps, request schemas, and a complete test suite.

### Implementation Details

**Current Foundation:**
- Complete `McpServer` class with handler setup and Maps
- `addTool()` method for registering tools
- Request handling via `CallToolRequestSchema`
- 14 existing tests covering server functionality

**1. Core Task Tools (`/src/mcp/tools/task-tools.ts`):**
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
1. **Create task tool definitions** with proper schema validation
2. **Implement tool registration system** using existing handler Maps
3. **Add tool tests** to extend existing 14-test suite
4. **Integrate with Core methods** for actual task operations

**Next Steps:**
- Tools provide foundation for agent task management
- Real Core integration enables actual task CRUD operations
- Additional tools can follow the same handler pattern

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Task creation tool (`task_create`) implemented with proper schema
- [ ] Task listing tool (`task_list`) with filtering capabilities
- [ ] Task update tool (`task_update`) for modifying existing tasks
- [ ] Tools registered with existing McpServer handler system
- [ ] Tool registration function exports all task management tools
- [ ] Extended test suite covers tool registration and basic functionality
- [ ] Tools validate input parameters and return appropriate responses
- [ ] All tests pass: `bun test src/test/mcp-server.test.ts`
<!-- AC:END -->
