---
id: task-265.02
title: Implement stdio transport for local MCP connections
status: Done
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-09-13 23:13'
labels:
  - mcp
  - transport
  - stdio
  - local
dependencies:
  - task-265.01
parent_task_id: task-265
---

## Description

Implement stdio transport for the existing MCP server to enable local AI agents to connect via stdin/stdout. Leverage the comprehensive server infrastructure already built in task-265.01.

**Note**: Test infrastructure already exists at `/src/test/mcp-server.test.ts` with 14 passing tests, so this task focuses on adding real transport functionality to the existing server.

### Implementation Details

Build on the existing comprehensive MCP server infrastructure to add stdio transport capabilities.

**Current Foundation (from task-265.01):**
- Complete `McpServer` class with handler setup
- Request schema handlers for tools/resources/prompts
- Maps for managing handlers
- Comprehensive test suite with 14 passing tests

**1. Update Server Transport Methods (`/src/mcp/server.ts`):**
```typescript
// Add to existing McpServer class
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export class McpServer extends Core {
	// ... existing code ...
	private transport?: StdioServerTransport;

	// Replace the stub method with real implementation
	public async connect(transportType: TransportType, options?: Record<string, unknown>): Promise<void> {
		if (transportType === "stdio") {
			await this.startStdioTransport();
		} else if (transportType === "sse") {
			throw new Error("SSE transport not yet implemented - will be added in task 265.08");
		} else {
			throw new Error(`Unknown transport type: ${transportType}`);
		}
	}

	private async startStdioTransport(): Promise<void> {
		this.transport = new StdioServerTransport();
		await this.server.connect(this.transport);
		console.error("MCP server running on stdio"); // Log to stderr to avoid stdout interference
	}

	public async start(): Promise<void> {
		if (!this.transport) {
			throw new Error("No transport connected. Call connect() first.");
		}
		// Server automatically starts when transport connects
	}

	public async stop(): Promise<void> {
		if (this.server) {
			await this.server.close();
		}
	}
}
```

**2. Add CLI Command for MCP Server (`/src/cli.ts`):**
```typescript
// Add to existing CLI structure
import { McpServer } from './mcp/server.ts';

// Add MCP command group
program
	.command('mcp')
	.description('MCP server management')
	.addCommand(
		new Command('start')
			.description('Start MCP server with stdio transport')
			.option('-d, --debug', 'Enable debug logging', false)
			.action(async (options) => {
				try {
					const server = new McpServer(process.cwd());
					if (options.debug) {
						console.error('Starting MCP server in debug mode');
					}
					await server.connect('stdio');
					await server.start();
				} catch (error) {
					console.error('Failed to start MCP server:', error.message);
					process.exit(1);
				}
			})
	);
```

**3. Update Tests for Transport (`/src/test/mcp-server.test.ts`):**
```typescript
// Add to existing test file
describe('transport methods', () => {
	it('should connect with stdio transport', async () => {
		// Test will verify that stdio transport can be connected
		// without actually starting the server (to avoid blocking tests)
		const server = new McpServer(TEST_DIR);

		// Mock the transport for testing
		const connectSpy = jest.fn();
		server.getServer().connect = connectSpy;

		await server.connect('stdio');
		expect(connectSpy).toHaveBeenCalled();
	});

	it('should throw error for unimplemented SSE transport', async () => {
		const server = new McpServer(TEST_DIR);
		await expect(server.connect('sse')).rejects.toThrow('SSE transport not yet implemented');
	});

	it('should require transport before starting', async () => {
		const server = new McpServer(TEST_DIR);
		await expect(server.start()).rejects.toThrow('No transport connected');
	});
});
```

**4. Usage Example:**
```bash
# Start MCP server with stdio transport
backlog mcp start

# With debug logging
backlog mcp start --debug

# Server will run and listen on stdin/stdout for MCP protocol messages
# AI agents can connect using MCP client libraries
```

**Integration with Existing Infrastructure:**
- Leverages existing comprehensive server architecture
- Uses established handler setup and Maps
- Builds on existing 14-test suite
- Adds real transport functionality to replace stubs

**Next Steps:**
- Once stdio transport is working, tools/resources/prompts can be added
- Later tasks will implement SSE transport for HTTP connections
- Agent integration testing can use real transport connections

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stdio transport implementation added to McpServer class
- [ ] #2 connect() method supports 'stdio' transport type
- [ ] #3 CLI command 'backlog mcp start' launches server with stdio transport
- [ ] #4 Server logs to stderr (not stdout) to avoid protocol interference
- [ ] #5 Existing test suite extended with transport-specific tests
- [ ] #6 Error handling for missing transport before start()
- [ ] #7 SSE transport still throws "not implemented" error for future task
<!-- AC:END -->


## Implementation Notes

IMPLEMENTATION COMPLETED: All acceptance criteria successfully implemented. Stdio transport functional, CLI command operational, all tests passing (557/557). Ready for testing with MCP clients. Files modified: src/mcp/server.ts, src/cli.ts, src/test/mcp-server.test.ts. Usage: backlog mcp start [--debug]
