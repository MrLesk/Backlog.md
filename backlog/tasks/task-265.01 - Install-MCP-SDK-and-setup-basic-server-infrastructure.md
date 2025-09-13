---
id: task-265.01
title: Install MCP SDK and setup basic server infrastructure
status: To Do
assignee: []
created_date: '2025-09-13 18:52'
labels:
  - mcp
  - setup
  - server
  - sdk
dependencies: []
parent_task_id: task-265
---

## Description

Install MCP SDK dependency and create minimal server infrastructure that extends the existing Core class. This provides the foundation for all MCP functionality while maintaining compatibility with existing backlog.md patterns.

### Implementation Details

**Package Installation:**
```bash
bun add @modelcontextprotocol/sdk
```

**Directory Structure:**
```
/src/mcp/
├── server.ts              # Main MCP server class
├── types.ts               # MCP-specific types
└── __tests__/             # Test directory (created later)
```

**Basic MCP Server (`/src/mcp/server.ts`):**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Core } from '../core/backlog.ts';

export interface McpCapabilities {
  tools: Record<string, any>;
  resources: Record<string, any>;
  prompts?: Record<string, any>;
}

export class McpServer extends Core {
  private server: Server;

  constructor(projectRoot: string) {
    super(projectRoot); // Inherit Core functionality
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
  }

  async initialize(): Promise<void> {
    // Minimal initialization - just ensure server is created
    // Transport-specific initialization will come in later tasks
  }

  async getCapabilities(): Promise<McpCapabilities> {
    return {
      tools: {},
      resources: {},
      prompts: {}
    };
  }

  // Method stub for future transport implementation
  async startTransport(type: 'stdio' | 'http'): Promise<void> {
    throw new Error('Transport not implemented yet - this will be added in task 265.02');
  }
}
```

**Basic MCP Types (`/src/mcp/types.ts`):**
```typescript
export interface McpToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface McpResourceRequest {
  uri: string;
}

export interface McpResourceResponse {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

// Basic types - will be expanded in later tasks
export type McpTransportType = 'stdio' | 'http';
```

**Integration Points:**
- Extend `Core` class to inherit existing task management functionality
- Follow existing TypeScript patterns from codebase
- Use Bun runtime compatibility
- Follow existing async/await patterns

**Implementation Steps:**
1. **Red**: Install MCP SDK dependency
2. **Green**: Create minimal server class that extends Core
3. **Green**: Add basic type definitions
4. **Refactor**: Ensure proper integration with existing Core patterns

**Next Steps:**
- Server instantiation provides foundation for transport implementation
- Type definitions establish contracts for tools and resources
- Core inheritance ensures access to existing backlog.md functionality

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] MCP SDK dependency added to package.json
- [ ] McpServer class created extending Core
- [ ] Basic MCP types defined in /src/mcp/types.ts
- [ ] Server can be instantiated without errors
- [ ] Server capabilities method implemented
- [ ] Transport method stub throws appropriate error
- [ ] All code follows existing codebase patterns and conventions
<!-- AC:END -->
