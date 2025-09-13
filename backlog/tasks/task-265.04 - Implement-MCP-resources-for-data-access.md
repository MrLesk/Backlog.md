---
id: task-265.04
title: Add core MCP tools for task management
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - tools
  - tasks
  - tdd
dependencies: ['task-265.03']
parent_task_id: task-265
---

## Description

Implement core MCP tools for task management operations: create, update, list, and read tasks. Follow TDD by extending existing test infrastructure to verify tool functionality.

### Implementation Details

**1. Task Management Tools (`/src/mcp/tools/task-tools.ts`):**
```typescript
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Task } from '../../types/index.ts';
import { McpServer } from '../server.ts';

export const taskCreateTool: Tool = {
  name: 'task_create',
  description: 'Create a new task in the backlog',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title (required)'
      },
      description: {
        type: 'string',
        description: 'Task description (optional)'
      },
      status: {
        type: 'string',
        description: 'Initial task status (optional, defaults to "To Do")'
      },
      assignee: {
        type: 'array',
        items: { type: 'string' },
        description: 'Task assignees (optional)'
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Task labels (optional)'
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Task priority (optional)'
      }
    },
    required: ['title']
  }
};

export const taskUpdateTool: Tool = {
  name: 'task_update',
  description: 'Update an existing task',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Task ID to update (required)'
      },
      title: {
        type: 'string',
        description: 'New task title (optional)'
      },
      description: {
        type: 'string',
        description: 'New task description (optional)'
      },
      status: {
        type: 'string',
        description: 'New task status (optional)'
      },
      assignee: {
        type: 'array',
        items: { type: 'string' },
        description: 'New task assignees (optional)'
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'New task labels (optional)'
      }
    },
    required: ['id']
  }
};

export const taskListTool: Tool = {
  name: 'task_list',
  description: 'List tasks with optional filtering',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status (optional)'
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee (optional)'
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by labels (optional)'
      }
    }
  }
};
```

**2. Tool Handler Implementation (`/src/mcp/tools/task-handlers.ts`):**
```typescript
import type { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '../server.ts';
import type { Task } from '../../types/index.ts';

export class TaskToolHandlers {
  constructor(private server: McpServer) {}

  async handleTaskCreate(request: CallToolRequest): Promise<CallToolResult> {
    try {
      const params = request.params.arguments as any;

      // Validate required fields
      if (!params.title || typeof params.title !== 'string') {
        throw new Error('Title is required and must be a string');
      }

      // Use Core's createTask method (inherited by McpServer)
      const task = await this.server.createTask({
        title: params.title,
        description: params.description,
        status: params.status || 'To Do',
        assignee: params.assignee || [],
        labels: params.labels || [],
        priority: params.priority
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: task
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TASK_CREATE_ERROR',
              message: error.message
            }
          })
        }],
        isError: true
      };
    }
  }

  async handleTaskUpdate(request: CallToolRequest): Promise<CallToolResult> {
    try {
      const params = request.params.arguments as any;

      if (!params.id) {
        throw new Error('Task ID is required');
      }

      // Get existing task
      const existingTask = await this.server.getTask(params.id);
      if (!existingTask) {
        throw new Error(`Task with ID '${params.id}' not found`);
      }

      // Update task with new values
      const updatedTask = await this.server.updateTask(params.id, {
        title: params.title || existingTask.title,
        description: params.description !== undefined ? params.description : existingTask.description,
        status: params.status || existingTask.status,
        assignee: params.assignee || existingTask.assignee,
        labels: params.labels || existingTask.labels
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: updatedTask
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TASK_UPDATE_ERROR',
              message: error.message
            }
          })
        }],
        isError: true
      };
    }
  }

  async handleTaskList(request: CallToolRequest): Promise<CallToolResult> {
    try {
      const params = request.params.arguments as any;

      // Build filter from parameters
      const filter: any = {};
      if (params.status) filter.status = params.status;
      if (params.assignee) filter.assignee = params.assignee;

      // Use Core's getAllTasks method with filtering
      let tasks = await this.server.getAllTasks();

      // Apply filters
      if (params.status) {
        tasks = tasks.filter(task => task.status === params.status);
      }
      if (params.assignee) {
        tasks = tasks.filter(task => task.assignee.includes(params.assignee));
      }
      if (params.labels && params.labels.length > 0) {
        tasks = tasks.filter(task =>
          params.labels.some((label: string) => task.labels.includes(label))
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: tasks,
            meta: {
              total: tasks.length,
              filters: params
            }
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TASK_LIST_ERROR',
              message: error.message
            }
          })
        }],
        isError: true
      };
    }
  }
}
```

**3. Server Integration (`/src/mcp/server.ts`):**
```typescript
import { taskCreateTool, taskUpdateTool, taskListTool } from './tools/task-tools.ts';
import { TaskToolHandlers } from './tools/task-handlers.ts';

export class McpServer extends Core {
  private toolHandlers: TaskToolHandlers;

  constructor(projectRoot: string) {
    super(projectRoot);
    this.toolHandlers = new TaskToolHandlers(this);
    // ... existing initialization
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // Register task management tools
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [taskCreateTool, taskUpdateTool, taskListTool]
      };
    });

    // Register tool call handlers
    this.server.setRequestHandler('tools/call', async (request) => {
      const toolName = request.params.name;

      switch (toolName) {
        case 'task_create':
          return await this.toolHandlers.handleTaskCreate(request);
        case 'task_update':
          return await this.toolHandlers.handleTaskUpdate(request);
        case 'task_list':
          return await this.toolHandlers.handleTaskList(request);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    });
  }
}
```

**4. Tool Testing (`/src/mcp/__tests__/unit/task-tools.test.ts`):**
```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { McpServer } from '../../server.ts';
import { MockMcpClient } from '../mcp-test-client.ts';
import { createMcpTestProject, cleanupTestProject } from '../test-utils.ts';

describe('MCP Task Tools', () => {
  let server: McpServer;
  let client: MockMcpClient;
  let projectPath: string;

  beforeEach(async () => {
    const project = await createMcpTestProject();
    projectPath = project.path;
    server = new McpServer(projectPath);
    client = new MockMcpClient(server);
  });

  afterEach(async () => {
    await cleanupTestProject(projectPath);
  });

  test('task_create creates valid task', async () => {
    const result = await client.callTool('task_create', {
      title: 'Test Task',
      description: 'Test description',
      priority: 'high'
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Test Task');
    expect(result.data.id).toMatch(/^task-\d+$/);
  });

  test('task_create validates required fields', async () => {
    const result = await client.callTool('task_create', {
      description: 'Missing title'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('TASK_CREATE_ERROR');
  });

  test('task_list filters by status', async () => {
    // Create test tasks
    await client.callTool('task_create', { title: 'Task 1', status: 'To Do' });
    await client.callTool('task_create', { title: 'Task 2', status: 'In Progress' });

    const result = await client.callTool('task_list', { status: 'To Do' });

    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((task: any) => task.status === 'To Do')).toBe(true);
  });

  test('task_update modifies existing task', async () => {
    // Create a task first
    const createResult = await client.callTool('task_create', { title: 'Original Title' });
    const taskId = createResult.data.id;

    // Update the task
    const updateResult = await client.callTool('task_update', {
      id: taskId,
      title: 'Updated Title',
      status: 'In Progress'
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.data.title).toBe('Updated Title');
    expect(updateResult.data.status).toBe('In Progress');
  });
});
```

**TDD Approach:**
- Tests written first for each tool
- Mock client tests tool handlers directly
- Real Core methods used for task operations
- Error handling verified for invalid inputs

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] Task management tools defined with proper schemas
- [ ] TaskToolHandlers class implements CRUD operations
- [ ] Tools integrated with MCP server request handlers
- [ ] Task tools use existing Core methods for consistency
- [ ] Unit tests verify tool functionality and error handling
- [ ] All tests pass: `bun test src/mcp/__tests__/unit/task-tools.test.ts`
- [ ] Tools available through `tools/list` endpoint
<!-- AC:END -->
