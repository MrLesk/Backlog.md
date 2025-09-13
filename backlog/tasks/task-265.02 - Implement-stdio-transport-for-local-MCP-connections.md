---
id: task-265.02
title: Create MCP test infrastructure following TDD principles
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - testing
  - infrastructure
  - tdd
dependencies: ['task-265.01']
parent_task_id: task-265
---

## Description

Create comprehensive test infrastructure for MCP development following true TDD principles. Write failing tests first, then create test utilities and mock clients for automated verification.

### Implementation Details

**Test Infrastructure Structure (`/src/mcp/__tests__/`):**
```
/src/mcp/__tests__/
├── test-utils.ts           # MCP-specific test utilities
├── mcp-test-client.ts      # Mock MCP client for testing (no CLI dependency)
├── mock-agent.ts           # Mock AI agent for testing workflows
├── fixtures/               # Test data and scenarios
│   ├── test-tasks.json
│   ├── test-board-states.json
│   └── test-scenarios.ts
├── unit/                   # Unit tests
│   └── server.test.ts
└── integration/            # Integration tests (implemented later)
    └── workflows.test.ts
```

**TDD Approach - Write Failing Tests First:**

**1. Server Unit Tests (`/src/mcp/__tests__/unit/server.test.ts`):**
```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { McpServer } from '../../server.ts';
import { createMcpTestProject } from '../test-utils.ts';

describe('McpServer', () => {
  let server: McpServer;
  let projectPath: string;

  beforeEach(async () => {
    const project = await createMcpTestProject();
    projectPath = project.path;
    server = new McpServer(projectPath);
  });

  test('can be instantiated with project path', () => {
    expect(server).toBeInstanceOf(McpServer);
    expect(server).toHaveProperty('getConfig'); // Inherited from Core
  });

  test('has MCP server capabilities', async () => {
    const capabilities = await server.getCapabilities();
    expect(capabilities).toHaveProperty('tools');
    expect(capabilities).toHaveProperty('resources');
  });

  test('can initialize without errors', async () => {
    await expect(server.initialize()).resolves.toBeUndefined();
  });

  test('transport methods throw appropriate errors when not implemented', async () => {
    await expect(server.startTransport('stdio')).rejects.toThrow('Transport not implemented yet');
    await expect(server.startTransport('http')).rejects.toThrow('Transport not implemented yet');
  });
});
```

**2. Mock MCP Client (No CLI Dependency) (`/src/mcp/__tests__/mcp-test-client.ts`):**
```typescript
import type { McpToolRequest, McpToolResponse, McpResourceRequest, McpResourceResponse } from '../types.ts';

/**
 * Mock MCP client for testing - does not depend on CLI or transport
 * Directly calls server methods for unit testing
 */
export class MockMcpClient {
  constructor(private server: any) {} // McpServer instance

  async callTool(name: string, params: any): Promise<McpToolResponse> {
    try {
      // This will be implemented when tools are added
      return {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: `Tool '${name}' not implemented yet`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      };
    }
  }

  async readResource(uri: string): Promise<McpResourceResponse> {
    try {
      // This will be implemented when resources are added
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Resource not implemented yet' })
        }]
      };
    } catch (error) {
      throw error;
    }
  }

  async initialize(): Promise<any> {
    return this.server.getCapabilities();
  }
}
```

**3. Test Utilities (`/src/mcp/__tests__/test-utils.ts`):**
```typescript
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Core } from '../../core/backlog.ts';
import { $ } from 'bun';

let testCounter = 0;

export function createUniqueTestDir(prefix = 'mcp-test'): string {
  return join(tmpdir(), `${prefix}-${Date.now()}-${++testCounter}`);
}

export async function createMcpTestProject(): Promise<{ path: string, core: Core }> {
  const testDir = createUniqueTestDir('mcp-test');
  await $`mkdir -p ${testDir}`.quiet();

  // Initialize git (required for backlog.md)
  await $`git init`.cwd(testDir).quiet();
  await $`git config user.email test@example.com`.cwd(testDir).quiet();
  await $`git config user.name "MCP Test"`.cwd(testDir).quiet();

  const core = new Core(testDir);
  await core.initializeProject('MCP Test Project');

  // Create some test tasks for scenarios
  await core.createTask({
    title: 'Sample Task 1',
    status: 'To Do',
    description: 'A sample task for MCP testing'
  });

  return { path: testDir, core };
}

export async function cleanupTestProject(projectPath: string): Promise<void> {
  try {
    await rm(projectPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors in tests
  }
}
```

**4. Mock Agent (`/src/mcp/__tests__/mock-agent.ts`):**
```typescript
import { MockMcpClient } from './mcp-test-client.ts';

export class MockAgent {
  constructor(private client: MockMcpClient) {}

  async createTaskScenario(requirement: string): Promise<any> {
    // Simulate agent workflow: analyze requirement -> create task
    // This will fail initially until tools are implemented
    const result = await this.client.callTool('task_create', {
      title: `Implement: ${requirement}`,
      description: `Task created by mock agent for: ${requirement}`,
      priority: 'medium',
      labels: ['agent-created']
    });

    return result;
  }

  async boardAnalysisScenario(): Promise<any> {
    // Simulate agent analyzing project state
    // This will fail initially until resources are implemented
    const board = await this.client.readResource('board/current');
    const config = await this.client.readResource('config/current');

    return {
      board: board.contents[0]?.text || 'No board data',
      config: config.contents[0]?.text || 'No config data',
      analysis: 'Mock analysis completed'
    };
  }
}
```

**TDD Cycle:**
1. **Red**: Write failing tests for server, client, and agent interactions
2. **Green**: Tests pass because they expect "not implemented" errors
3. **Red**: Add tests for actual functionality (will fail)
4. **Green**: Implement functionality to make tests pass

**Key TDD Principles:**
- Tests written before implementation exists
- Mock client eliminates transport dependencies
- Test utilities provide consistent project setup
- Failing tests guide implementation priorities

**Next Steps:**
- All tests initially pass because they expect "not implemented" errors
- Later tasks will add functionality and make tests expect real behavior
- Transport implementation can use this test infrastructure

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Test infrastructure directory created at /src/mcp/__tests__/
- [ ] MockMcpClient class implemented for testing (no CLI dependency)
- [ ] MockAgent class created for workflow scenario testing
- [ ] MCP test utilities extend existing test patterns
- [ ] Server unit tests written (expecting appropriate errors)
- [ ] Test command `bun test src/mcp/__tests__/unit` passes
- [ ] All test infrastructure follows existing codebase patterns
<!-- AC:END -->
