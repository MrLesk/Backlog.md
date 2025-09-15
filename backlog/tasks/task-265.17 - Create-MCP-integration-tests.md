---
id: task-265.17
title: Create MCP integration tests
status: To Do
assignee: []
created_date: '2025-09-15 12:50'
labels:
  - mcp
  - testing
  - integration
dependencies: ['task-265.10']
parent_task_id: task-265
priority: medium
---

## Description

Add comprehensive integration tests for MCP protocol communication to ensure reliable operation with real clients and validate end-to-end functionality.

### Technical Context

Integration tests are crucial for validating MCP protocol implementation beyond unit tests. These tests will:

- **Protocol Testing**: Test actual MCP protocol communication
- **Large Payload Testing**: Validate handling of large responses and token limits
- **Timeout Scenarios**: Test timeout and error handling
- **Malformed Request Testing**: Ensure robust error handling

### Implementation Details

**Integration Test Structure (`/src/mcp/__tests__/integration/`):**
```
/src/mcp/__tests__/integration/
├── protocol-communication.test.ts    # MCP protocol tests
├── large-payload.test.ts             # Large response handling
├── timeout-scenarios.test.ts         # Timeout and resilience
├── malformed-requests.test.ts        # Error handling
├── oauth2-integration.test.ts        # Authentication flows
├── performance-integration.test.ts   # Performance under load
└── helpers/
    ├── test-mcp-client.ts           # Test MCP client
    ├── test-scenarios.ts            # Common test scenarios
    └── mock-services.ts             # Mock external services
```

**Test MCP Client (`/src/mcp/__tests__/integration/helpers/test-mcp-client.ts`):**
```typescript
export class TestMcpClient {
  private transport: Transport;
  private client: Client;

  constructor(transport: Transport) {
    this.transport = transport;
    this.client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async callTool(name: string, arguments_: unknown): Promise<CallToolResult> {
    return await this.client.request(
      { method: 'tools/call', params: { name, arguments: arguments_ } },
      CallToolResultSchema
    );
  }

  async listTools(): Promise<ListToolsResult> {
    return await this.client.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema
    );
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    return await this.client.request(
      { method: 'resources/read', params: { uri } },
      ReadResourceResultSchema
    );
  }

  async listResources(): Promise<ListResourcesResult> {
    return await this.client.request(
      { method: 'resources/list', params: {} },
      ListResourcesResultSchema
    );
  }

  async getPrompt(name: string, arguments_: unknown): Promise<GetPromptResult> {
    return await this.client.request(
      { method: 'prompts/get', params: { name, arguments: arguments_ } },
      GetPromptResultSchema
    );
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
```

**Protocol Communication Tests:**
```typescript
describe('MCP Protocol Communication', () => {
  let server: McpServer;
  let client: TestMcpClient;
  let testDir: string;

  beforeEach(async () => {
    testDir = createUniqueTestDir('.tmp-test-mcp-integration');

    // Initialize test project structure
    await setupTestProject(testDir);

    // Start MCP server
    server = new McpServer(testDir);
    await server.initialize();

    // Create stdio transport pair
    const [clientTransport, serverTransport] = createStdioTransportPair();

    // Connect server
    await server.connect(serverTransport);

    // Connect client
    client = new TestMcpClient(clientTransport);
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect();
    await server?.stop();
    safeCleanup(testDir);
  });

  test('should list available tools', async () => {
    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThan(0);

    // Verify expected tools are present
    const toolNames = result.tools.map(tool => tool.name);
    expect(toolNames).toContain('task_create');
    expect(toolNames).toContain('task_list');
    expect(toolNames).toContain('board_view');
  });

  test('should create task via MCP protocol', async () => {
    const taskData = {
      title: 'Test task via MCP',
      description: 'Created through integration test',
      priority: 'high',
      labels: ['test', 'mcp']
    };

    const result = await client.callTool('task_create', taskData);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.data.id).toBeDefined();
    expect(response.data.title).toBe(taskData.title);
  });

  test('should handle malformed tool requests', async () => {
    const result = await client.callTool('task_create', {
      // Missing required title field
      description: 'Invalid task'
    });

    expect(result.isError).toBe(true);
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('VALIDATION_ERROR');
  });

  test('should list and read resources', async () => {
    // First create a task to have resources available
    await client.callTool('task_create', {
      title: 'Resource test task',
      description: 'For testing resource access'
    });

    // List resources
    const resourceList = await client.listResources();
    expect(resourceList.resources).toBeDefined();
    expect(resourceList.resources.length).toBeGreaterThan(0);

    // Read a specific resource
    const boardResource = resourceList.resources.find(r =>
      r.uri === 'board/current'
    );
    expect(boardResource).toBeDefined();

    const boardData = await client.readResource('board/current');
    expect(boardData.contents).toBeDefined();
    expect(boardData.contents[0].mimeType).toBe('application/json');
  });
});
```

**Large Payload Tests:**
```typescript
describe('MCP Large Payload Handling', () => {
  let server: McpServer;
  let client: TestMcpClient;
  let testDir: string;

  beforeEach(async () => {
    testDir = createUniqueTestDir('.tmp-test-mcp-large-payload');
    await setupTestProject(testDir);

    // Create many tasks for large response testing
    await createManyTestTasks(testDir, 100);

    server = new McpServer(testDir);
    await server.initialize();

    const [clientTransport, serverTransport] = createStdioTransportPair();
    await server.connect(serverTransport);

    client = new TestMcpClient(clientTransport);
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect();
    await server?.stop();
    safeCleanup(testDir);
  });

  test('should handle large task list responses', async () => {
    // Set a low token limit for testing
    process.env.MAX_MCP_OUTPUT_TOKENS = '5000';

    const result = await client.callTool('task_list', {});

    expect(result.content).toBeDefined();
    const response = JSON.parse(result.content[0].text);

    // Should succeed but potentially be limited
    expect(response.success).toBe(true);

    // Check if truncation message is present for large responses
    const responseText = result.content[0].text;
    if (responseText.includes('Content truncated')) {
      expect(responseText).toContain('Original');
      expect(responseText).toContain('tokens exceeded limit');
    }
  });

  test('should handle malformed large payloads', async () => {
    const largeInvalidData = {
      title: 'a'.repeat(10000), // Extremely long title
      description: 'b'.repeat(50000), // Very long description
      invalidField: 'c'.repeat(5000)
    };

    const result = await client.callTool('task_create', largeInvalidData);

    expect(result.isError).toBe(true);
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('VALIDATION_ERROR');
  });
});
```

**Timeout Scenario Tests:**
```typescript
describe('MCP Timeout and Error Scenarios', () => {
  let server: McpServer;
  let client: TestMcpClient;
  let testDir: string;

  test('should handle connection timeouts', async () => {
    testDir = createUniqueTestDir('.tmp-test-mcp-timeout');

    // Create server but don't start it
    server = new McpServer(testDir);

    // Try to connect client to non-existent server
    const transport = new StdioClientTransport({
      command: 'non-existent-command',
      args: []
    });

    client = new TestMcpClient(transport);

    await expect(client.connect()).rejects.toThrow();
  });

  test('should handle slow operations with timeout', async () => {
    testDir = createUniqueTestDir('.tmp-test-mcp-slow-ops');
    await setupTestProject(testDir);

    // Mock a slow operation by creating many files
    await createManyTestTasks(testDir, 1000);

    server = new McpServer(testDir);
    await server.initialize();

    const [clientTransport, serverTransport] = createStdioTransportPair();
    await server.connect(serverTransport);

    client = new TestMcpClient(clientTransport);
    await client.connect();

    // This should still complete but might be slow
    const startTime = Date.now();
    const result = await client.callTool('task_list', {});
    const duration = Date.now() - startTime;

    expect(result.content).toBeDefined();
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
  });
});
```

**OAuth2 Integration Tests:**
```typescript
describe('MCP OAuth2 Integration', () => {
  let server: McpServer;
  let httpServer: any;
  let testDir: string;

  beforeEach(async () => {
    testDir = createUniqueTestDir('.tmp-test-mcp-oauth2');
    await setupTestProject(testDir);

    // Mock OAuth2 server
    httpServer = createMockOAuth2Server();

    // Configure MCP server with OAuth2
    process.env.BACKLOG_MCP_OAUTH_CLIENT_ID = 'test-client';
    process.env.BACKLOG_MCP_OAUTH_CLIENT_SECRET = 'test-secret';
    process.env.BACKLOG_MCP_OAUTH_TOKEN_URL = 'http://localhost:3001/oauth/token';

    server = new McpServer(testDir);
    await server.initialize();
    await server.connect('http');
  });

  afterEach(async () => {
    await server?.stop();
    httpServer?.close();
    safeCleanup(testDir);
  });

  test('should authenticate with valid OAuth2 token', async () => {
    const token = await getValidTestToken();

    const response = await fetch('http://localhost:3000/tools/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'task_list',
          arguments: {}
        }
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should reject invalid OAuth2 token', async () => {
    const response = await fetch('http://localhost:3000/tools/call', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: { name: 'task_list', arguments: {} }
      })
    });

    expect(response.status).toBe(401);
  });
});
```

**Performance Integration Tests:**
```typescript
describe('MCP Performance Integration', () => {
  test('should handle concurrent requests efficiently', async () => {
    const testDir = createUniqueTestDir('.tmp-test-mcp-performance');
    await setupTestProject(testDir);

    const server = new McpServer(testDir);
    await server.initialize();

    const [clientTransport, serverTransport] = createStdioTransportPair();
    await server.connect(serverTransport);

    const client = new TestMcpClient(clientTransport);
    await client.connect();

    // Create multiple concurrent requests
    const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
      client.callTool('task_create', {
        title: `Concurrent task ${i}`,
        description: `Created in performance test`
      })
    );

    const startTime = Date.now();
    const results = await Promise.all(concurrentRequests);
    const duration = Date.now() - startTime;

    // All requests should succeed
    results.forEach(result => {
      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    // Performance should be reasonable
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

    await client.disconnect();
    await server.stop();
    safeCleanup(testDir);
  });
});
```

**Test Helpers and Utilities:**
```typescript
// Helper functions for integration tests
export async function setupTestProject(testDir: string): Promise<void> {
  const { mkdirSync, writeFileSync } = await import('node:fs');

  // Create directory structure
  mkdirSync(join(testDir, 'backlog', 'tasks'), { recursive: true });
  mkdirSync(join(testDir, 'backlog', 'boards'), { recursive: true });

  // Create basic config
  writeFileSync(join(testDir, 'config.yml'), `
mcp:
  enabled: true
  stdio:
    enabled: true
  http:
    enabled: false
`);
}

export async function createManyTestTasks(testDir: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const taskContent = `---
id: task-${i}
title: Test task ${i}
status: To Do
assignee: []
created_date: '2025-09-15 12:00'
labels: [test]
---

## Description
Test task ${i} for integration testing.
`;
    await Bun.write(join(testDir, 'backlog', 'tasks', `task-${i}.md`), taskContent);
  }
}
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Test actual MCP protocol communication end-to-end
- [ ] Test large payload handling and token limits
- [ ] Test timeout scenarios and error recovery
- [ ] Test malformed request handling
- [ ] Test OAuth2 authentication flows (if implemented)
- [ ] Test concurrent request handling and performance
- [ ] Test stdio and HTTP transport integration
- [ ] Create comprehensive test helpers and utilities
- [ ] Integrate with existing test suite
- [ ] Document integration test setup and execution
<!-- AC:END -->