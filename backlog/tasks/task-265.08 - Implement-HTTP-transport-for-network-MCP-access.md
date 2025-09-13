---
id: task-265.08
title: Implement HTTP transport for network MCP access
status: To Do
assignee: []
created_date: '2025-09-13 18:53'
labels:
  - mcp
  - transport
  - http
  - network
dependencies: []
parent_task_id: task-265
---

## Description

Add HTTP/SSE transport support to enable remote AI agents and web applications to connect to the MCP server over the network.

### Implementation Details

**HTTP Transport Setup (`/src/mcp/server.ts`):**
```typescript
import { SseServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export class McpServer extends Core {
  async initializeHttpTransport(options: {
    port: number,
    host: string
  }): Promise<void> {
    const transport = new SseServerTransport('/message', options);

    await this.server.connect(transport);
    console.error(`MCP server running on http://${options.host}:${options.port}`);
  }
}
```

**HTTP Server Configuration:**
- Use MCP SDK's built-in SSE transport for bidirectional communication
- Support configurable host/port binding
- Implement CORS headers for web client access
- Add request/response logging for debugging

**Server-Sent Events (SSE) Implementation:**
```typescript
// SSE endpoint: GET /message
// Clients connect to receive server events
// POST /message for client->server communication

app.get('/message', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  // Handle SSE connection
  transport.handleConnection(req, res);
});
```

**Authentication and Security:**
```typescript
interface HttpTransportConfig {
  enabled: boolean;
  port: number;
  host: string;
  cors?: {
    origins: string[];
    credentials: boolean;
  };
  auth?: {
    type: 'bearer' | 'basic' | 'none';
    token?: string;
  };
}
```

**CORS Configuration:**
- Support configurable allowed origins
- Handle preflight OPTIONS requests
- Secure headers for production deployment
- Development mode with permissive CORS

**Integration with Bun.serve:**
```typescript
// Use Bun's built-in HTTP server for better performance
const server = Bun.serve({
  port: options.port,
  hostname: options.host,
  fetch: async (req) => {
    const url = new URL(req.url);

    if (url.pathname === '/message') {
      if (req.method === 'GET') {
        return handleSSEConnection(req);
      } else if (req.method === 'POST') {
        return handleMCPMessage(req);
      }
    }

    return new Response('Not Found', { status: 404 });
  }
});
```

**Network Agent Connection:**
```typescript
// Agents connect via HTTP/SSE
const mcpClient = new Client({
  transport: new SseClientTransport('http://localhost:3000/message')
});
```

**Configuration Integration:**
- Extend BacklogConfig with HTTP transport settings
- Support environment-based configuration
- Validate network settings on startup
- Handle port conflicts gracefully

**Security Considerations:**
- Optional authentication token validation
- Request rate limiting
- Input validation for all HTTP endpoints
- Secure headers (CSP, HSTS when applicable)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] HTTP transport accepts connections on configurable port
- [ ] Server-Sent Events (SSE) support for real-time updates
- [ ] CORS configuration for web client access
- [ ] Authentication mechanism for secure access
- [ ] HTTP endpoints follow MCP specification
- [ ] Transport switching between stdio and HTTP works correctly
<!-- AC:END -->
