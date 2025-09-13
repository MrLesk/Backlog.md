---
id: task-265.12
title: Create MCP documentation and usage examples
status: To Do
assignee: []
created_date: '2025-09-13 18:53'
labels:
  - mcp
  - documentation
  - examples
dependencies: []
parent_task_id: task-265
---

## Description

Document the MCP implementation with comprehensive guides for agents and developers on how to integrate with and use the backlog.md MCP server.

### Implementation Details

**Documentation Structure:**
```
docs/
├── mcp/
│   ├── README.md                 # Overview and quick start
│   ├── setup.md                  # Server setup and configuration
│   ├── api-reference.md          # Complete API documentation
│   ├── agent-integration.md      # Integration guide for agents
│   ├── configuration.md          # Configuration options
│   ├── troubleshooting.md        # Common issues and solutions
│   └── examples/
│       ├── claude-integration.md
│       ├── custom-agent.md
│       └── workflow-examples.md
```

**Main Documentation (`docs/mcp/README.md`):**
```markdown
# Backlog.md MCP Integration

The backlog.md MCP (Model Context Protocol) server enables AI agents to interact directly with your project tasks, board state, and configuration through a standardized protocol.

## Quick Start

### 1. Start the MCP Server
```bash
# Stdio transport (for local agents)
backlog mcp start

# HTTP transport (for network agents)
backlog mcp start --transport http --port 3000
```

### 2. Connect Your Agent
```bash
# Claude Desktop (stdio)
# Add to ~/.config/claude-desktop/claude_desktop_config.json
{
  "mcpServers": {
    "backlog-md": {
      "command": "backlog",
      "args": ["mcp", "start", "--transport", "stdio"]
    }
  }
}

# HTTP client example
const client = new McpClient({
  transport: new SseClientTransport('http://localhost:3000/message')
});
```

## Features

- **Task Management**: Create, update, list, and archive tasks
- **Board Access**: View kanban board state and metrics
- **Configuration**: Read and modify project settings
- **Workflow Templates**: Guided prompts for common workflows
- **Dual Transport**: Both stdio and HTTP/SSE support

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `task_create` | Create a new task | title, description, status, assignee, labels, priority |
| `task_update` | Update existing task | id, title, description, status, assignee, labels |
| `task_list` | List tasks with filtering | status, assignee, labels |
| `board_view` | Get kanban board state | includeMetadata |
| `config_get` | Retrieve configuration | key (optional) |
| `config_set` | Update configuration | key, value |

## Resources

| Resource | Description |
|----------|-------------|
| `task/{id}` | Individual task details |
| `tasks/status/{status}` | Tasks by status |
| `board/current` | Current board state |
| `config/current` | Project configuration |

## Workflow Prompts

| Prompt | Description | Use Case |
|--------|-------------|----------|
| `task_creation_workflow` | Guided task creation | Convert requirements to tasks |
| `sprint_planning` | Sprint planning assistance | Organize tasks into sprints |
| `code_review_integration` | Code review workflows | Link reviews to tasks |
```

**Setup Guide (`docs/mcp/setup.md`):**
```markdown
# MCP Server Setup Guide

## Installation

1. Ensure backlog.md CLI is installed:
```bash
npm install -g backlog.md
```

2. Verify MCP support:
```bash
backlog mcp status
```

## Configuration

### Basic Configuration
```yaml
# config.yml
mcp:
  enabled: true
  transports:
    stdio:
      enabled: true
    http:
      enabled: false
      port: 3000
      host: localhost
```

### Security Configuration
```yaml
mcp:
  security:
    authentication:
      enabled: true
      type: bearer
      token: "your-secure-token"
    inputValidation:
      enabled: true
      strictMode: true
  rateLimiting:
    enabled: true
    maxRequestsPerMinute: 100
```

## Transport Options

### Stdio Transport
- **Best for**: Local AI agents (Claude Desktop, local scripts)
- **Security**: Inherits local system permissions
- **Performance**: Low latency, direct process communication

### HTTP Transport
- **Best for**: Web applications, remote agents, development
- **Security**: Token-based authentication, CORS support
- **Performance**: Network latency, scalable to multiple clients
```

**API Reference (`docs/mcp/api-reference.md`):**
```markdown
# MCP API Reference

## Tools

### task_create

Create a new task in the backlog.

**Parameters:**
```json
{
  "title": "Task title (required)",
  "description": "Task description (optional)",
  "status": "Initial status (optional, defaults to 'To Do')",
  "assignee": ["assignee1", "assignee2"] (optional),
  "labels": ["label1", "label2"] (optional),
  "priority": "high|medium|low (optional)",
  "acceptanceCriteria": ["criteria1", "criteria2"] (optional)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "title": "Task title",
    "status": "To Do",
    "createdDate": "2025-09-13",
    ...
  }
}
```

**Example:**
```javascript
const result = await client.callTool('task_create', {
  title: 'Implement user authentication',
  description: 'Add JWT-based authentication system',
  priority: 'high',
  labels: ['backend', 'security'],
  acceptanceCriteria: [
    'Users can register with email/password',
    'JWT tokens are issued on login',
    'Protected routes validate tokens'
  ]
});
```

### task_list

List tasks with optional filtering.

**Parameters:**
```json
{
  "status": "Filter by status (optional)",
  "assignee": "Filter by assignee (optional)",
  "labels": ["Filter by labels (optional)"]
}
```

## Resources

### task/{id}

Get detailed information about a specific task.

**URI:** `task/123` or `task/123.01` (for sub-tasks)

**Response:**
```json
{
  "contents": [{
    "uri": "task/123",
    "mimeType": "application/json",
    "text": "{\"id\":\"task-123\",\"title\":\"...\",\"status\":\"...\"}"
  }]
}
```

### board/current

Get the current kanban board state with task distribution.

**Response includes:**
- Tasks organized by status columns
- Task counts per status
- Completion metrics
- Board metadata
```

**Agent Integration Examples (`docs/mcp/examples/claude-integration.md`):**
```markdown
# Claude Desktop Integration

## Setup

1. Add MCP server to Claude Desktop configuration:
```json
{
  "mcpServers": {
    "backlog-md": {
      "command": "backlog",
      "args": ["mcp", "start", "--transport", "stdio"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

2. Restart Claude Desktop

## Usage Examples

### Create a Task
```
Create a new task for implementing OAuth integration with Google.
It should be high priority and include proper error handling.
```

Claude will use the task_create tool to create a well-structured task.

### Review Project Status
```
Show me the current status of all tasks and highlight any blockers.
```

Claude will use board_view and task_list to provide a comprehensive overview.

### Plan Next Sprint
```
Help me plan the next sprint. We have capacity for 20 story points
and want to focus on user experience improvements.
```

Claude will use the sprint_planning prompt to organize tasks.

## Workflow Examples

### Bug Triage
```
I found a bug where users can't login with special characters in passwords.
Create a task and suggest related testing tasks.
```

### Feature Planning
```
We want to add dark mode to the application. Break this down into
tasks and estimate the complexity.
```
```

**Configuration Guide (`docs/mcp/configuration.md`):**
```markdown
# MCP Configuration Guide

## Configuration File Structure

MCP settings are stored in your project's `config.yml` file:

```yaml
mcp:
  enabled: true

  transports:
    stdio:
      enabled: true
    http:
      enabled: false
      port: 3000
      host: localhost
      cors:
        enabled: true
        origins: ["*"]
        credentials: false

  security:
    authentication:
      enabled: false
      type: none
    inputValidation:
      enabled: true
      strictMode: true

  rateLimiting:
    enabled: true
    maxRequestsPerMinute: 100
    windowSizeMs: 60000

  server:
    name: backlog-md-mcp
    version: 1.0.0
    timeout: 30000
    maxConnections: 10
```

## Configuration via CLI

```bash
# Enable MCP server
backlog config set mcp.enabled true

# Configure HTTP transport
backlog config set mcp.transports.http.enabled true
backlog config set mcp.transports.http.port 3000

# Set up authentication
backlog config set mcp.security.authentication.enabled true
backlog config set mcp.security.authentication.type bearer
backlog config set mcp.security.authentication.token "your-token"

# Adjust rate limiting
backlog config set mcp.rateLimiting.maxRequestsPerMinute 200
```

## Environment Variables

```bash
# Override default MCP port
export BACKLOG_MCP_PORT=3001

# Set authentication token
export BACKLOG_MCP_TOKEN=your-secure-token

# Enable debug logging
export BACKLOG_MCP_DEBUG=true
```
```

**Documentation Integration Points:**
- Add MCP section to main README.md
- Link from CLI help text to online documentation
- Include examples in JSDoc comments
- Create TypeScript definition files with documentation
- Add MCP endpoints to API documentation generator

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] MCP server setup documentation created
- [ ] Agent integration examples provided
- [ ] API reference for all tools and resources
- [ ] Configuration guide with examples
- [ ] Troubleshooting section for common issues
- [ ] Usage examples for popular AI agents
<!-- AC:END -->
