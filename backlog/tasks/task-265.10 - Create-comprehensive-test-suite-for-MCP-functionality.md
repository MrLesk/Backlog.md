---
id: task-265.10
title: Create comprehensive test suite for MCP functionality
status: To Do
assignee: []
created_date: '2025-09-13 18:53'
labels:
  - mcp
  - testing
  - quality
dependencies: []
parent_task_id: task-265
---

## Description

Develop thorough unit and integration tests for all MCP components to ensure reliability and maintainability of the agent integration features.

### Implementation Details

**Test Structure (`/src/mcp/__tests__/`):**
```
/src/mcp/__tests__/
├── unit/
│   ├── tools/
│   │   ├── task-tools.test.ts
│   │   ├── board-tools.test.ts
│   │   └── config-tools.test.ts
│   ├── resources/
│   │   └── data-resources.test.ts
│   ├── validation/
│   │   └── validators.test.ts
│   └── server.test.ts
├── integration/
│   ├── workflows.test.ts
│   ├── transports.test.ts
│   └── end-to-end.test.ts
└── mocks/
    ├── mock-agent.ts
    └── test-fixtures.ts
```

**Unit Test Example (`task-tools.test.ts`):**
```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { McpServer } from '../server.ts';
import { createTestProject, cleanupTestProject } from './test-utils.ts';

describe('MCP Task Tools', () => {
  let server: McpServer;
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await createTestProject();
    server = new McpServer(projectPath);
  });

  afterEach(async () => {
    await cleanupTestProject(projectPath);
  });

  test('task_create creates valid task', async () => {
    const result = await server.handleTool('task_create', {
      title: 'Test Task',
      description: 'Test description',
      priority: 'high'
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Test Task');
    expect(result.data.id).toMatch(/^task-\d+$/);
  });

  test('task_create validates required fields', async () => {
    const result = await server.handleTool('task_create', {
      description: 'Missing title'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  test('task_list filters by status', async () => {
    // Create test tasks
    await server.handleTool('task_create', { title: 'Task 1', status: 'To Do' });
    await server.handleTool('task_create', { title: 'Task 2', status: 'In Progress' });

    const result = await server.handleTool('task_list', { status: 'To Do' });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Task 1');
  });
});
```

**Integration Test Example (`workflows.test.ts`):**
```typescript
import { test, expect } from 'bun:test';
import { McpClient } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('MCP Workflow Integration', () => {
  test('complete task creation workflow', async () => {
    // Start MCP server process
    const serverProcess = Bun.spawn(['backlog', 'mcp', 'start', '--transport', 'stdio']);

    // Create client connection
    const transport = new StdioClientTransport({
      command: 'backlog',
      args: ['mcp', 'start', '--transport', 'stdio']
    });

    const client = new McpClient({
      name: 'test-agent',
      version: '1.0.0'
    });

    await client.connect(transport);

    try {
      // Test full workflow
      const createResult = await client.callTool('task_create', {
        title: 'Integration Test Task',
        priority: 'medium'
      });

      expect(createResult.success).toBe(true);

      const taskId = createResult.data.id;

      // Verify task exists via resource
      const resourceResult = await client.readResource(`task/${taskId}`);
      expect(resourceResult.contents[0].text).toContain('Integration Test Task');

      // Update task
      const updateResult = await client.callTool('task_update', {
        id: taskId,
        status: 'In Progress'
      });

      expect(updateResult.success).toBe(true);

    } finally {
      await client.disconnect();
      serverProcess.kill();
    }
  });
});
```

**Mock Agent Implementation (`mock-agent.ts`):**
```typescript
export class MockAgent {
  constructor(private client: McpClient) {}

  async createTaskFromRequirement(requirement: string): Promise<Task> {
    // Use task creation prompt
    const promptResult = await this.client.getPrompt('task_creation_workflow', {
      projectContext: await this.getProjectContext(),
      userRequirement: requirement
    });

    // Parse prompt response and execute tools
    return this.executePromptWorkflow(promptResult);
  }

  async planSprint(capacity: number): Promise<SprintPlan> {
    const boardState = await this.client.readResource('board/current');

    const promptResult = await this.client.getPrompt('sprint_planning', {
      boardState: boardState.contents[0].text,
      sprintCapacity: capacity
    });

    return this.executeSprintPlanning(promptResult);
  }

  private async getProjectContext(): Promise<string> {
    const config = await this.client.readResource('config/current');
    const board = await this.client.readResource('board/current');

    return `Config: ${config.contents[0].text}\nBoard: ${board.contents[0].text}`;
  }
}
```

**Transport Layer Tests:**
```typescript
describe('MCP Transports', () => {
  test('stdio transport handles multiple concurrent connections', async () => {
    const connections = await Promise.all([
      createStdioConnection(),
      createStdioConnection(),
      createStdioConnection()
    ]);

    // Test concurrent operations
    const results = await Promise.all(
      connections.map(conn => conn.callTool('board_view', {}))
    );

    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Cleanup
    await Promise.all(connections.map(conn => conn.disconnect()));
  });

  test('HTTP transport handles CORS correctly', async () => {
    const server = await startHttpServer({ port: 3001 });

    const response = await fetch('http://localhost:3001/message', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'POST'
      }
    });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');

    await server.stop();
  });
});
```

**Performance Tests:**
```typescript
describe('MCP Performance', () => {
  test('handles 50 concurrent agents efficiently', async () => {
    const startTime = Date.now();

    const agents = Array.from({ length: 50 }, () => new MockAgent());

    const results = await Promise.all(
      agents.map(agent => agent.createTaskFromRequirement('Test requirement'))
    );

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(50);
    expect(results.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
```

**Test Configuration:**
- Use Bun's built-in test runner
- Set up test databases/projects for isolation
- Mock file system operations where needed
- Use temporary directories for integration tests
- Clean up test resources after each test

**Coverage Requirements:**
- Minimum 80% code coverage for MCP components
- 100% coverage for critical security/validation code
- Integration test coverage for all major workflows
- Performance benchmarks for concurrent usage

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Unit tests for all MCP tools and resources
- [ ] Integration tests for full MCP workflows
- [ ] Mock agents for automated testing
- [ ] Transport layer testing for both stdio and HTTP
- [ ] Performance tests for concurrent agent connections
- [ ] Test coverage reports show adequate coverage
<!-- AC:END -->
