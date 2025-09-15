# Claude Code Setup Guide

This guide walks you through setting up the Backlog.md MCP server with Claude Code for seamless task management integration.

## Prerequisites

1. **Backlog.md CLI installed**:
   ```bash
   npm install -g backlog.md
   # or
   bun add -g backlog.md
   ```

2. **Bun runtime available**:
   ```bash
   # Install Bun if not already installed
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Valid backlog.md project**:
   ```bash
   # Initialize if needed
   backlog init "My Project"
   ```

## Installation Steps

### Step 1: Verify MCP Implementation

First, ensure all dependencies are installed and tests pass:

```bash
# Navigate to your backlog.md project
cd /path/to/your/project

# Install dependencies
bun install

# Run MCP tests
bun test src/mcp
```

Expected output: All 153 tests should pass.

### Step 2: Set Up MCP Configuration

Create the MCP configuration for Claude Code:

```bash
# Automatically creates .mcp.json with the right configuration
backlog mcp setup
```

This command will:
- Detect your installation type (development vs global)
- Copy the appropriate template file
- Create `.mcp.json` for Claude Code to detect

The resulting configuration uses an intelligent wrapper script that automatically detects your environment and routes to the appropriate MCP server.

**`src/mcp-stdio-server.ts`** (MCP server entry point):
This file should exist and be executable. It handles the stdio communication with Claude Code.

### Step 3: Test MCP Server Manually

Test the server startup:

```bash
# Test stdio server (should show startup message on stderr)
bun run src/mcp-stdio-server.ts
# Press Ctrl+C to stop

# Alternative: Test via CLI
backlog mcp start
# Press Ctrl+C to stop
```

### Step 4: Claude Code Integration

Claude Code will automatically detect the `.mcp.json` file when you open the project. You should see:

1. **MCP Server Status**: Claude Code will show that the backlog-md server is connected
2. **Available Tools**: Tools like `task_create`, `task_list`, `board_view` will be available
3. **Workflow Prompts**: Templates like `task_creation_workflow` will be accessible

## Verification

### Test Basic Functionality

Try these commands in Claude Code:

**1. Create a test task:**
```
Create a new task called "Test MCP integration" with description "Verify that MCP server is working correctly"
```

**2. List current tasks:**
```
Show me all current tasks in the backlog
```

**3. View board state:**
```
Display the current kanban board status
```

### Expected Behavior

- **Task Creation**: Claude should use the `task_create` tool and return a task ID
- **Task Listing**: Claude should use `task_list` tool and show formatted results
- **Board View**: Claude should use `board_view` tool and display current status distribution

## Configuration Options

### Environment Variables

You can customize the MCP server behavior with environment variables:

```json
{
  "mcpServers": {
    "backlog-md": {
      "command": "node",
      "args": ["${workspaceFolder}/scripts/mcp-server.cjs"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "${workspaceFolder}",
        "BACKLOG_MCP_DEBUG": "true",
        "BACKLOG_DEFAULT_ASSIGNEE": "your-username"
      }
    }
  }
}
```

### Project-Specific Configuration

Update your `config.yml` to customize MCP behavior:

```yaml
mcp:
  enabled: true
  defaultAssignee: "your-username"
  defaultLabels:
    - "ai-generated"
  security:
    inputValidation:
      enabled: true
      strictMode: true
  rateLimiting:
    enabled: true
    maxRequestsPerMinute: 100
```

## Advanced Usage

### Custom Workflow Prompts

The MCP server includes several workflow templates:

**1. Task Creation Workflow:**
```
Use the task creation workflow to break down this requirement:
"Users need to be able to reset their passwords via email"
```

**2. Sprint Planning:**
```
Help me plan the next sprint using the sprint planning workflow.
We have 3 developers and 2 weeks available.
```

**3. Code Review Integration:**
```
I just opened PR #123 for the authentication system.
Use the code review workflow to link it to relevant tasks.
```

### Resource Access

Claude Code can also access read-only resources:

```
Read the task details for task-123 using the task resource
```

```
Show me all tasks with status "In Progress" using the tasks/status resource
```

## Troubleshooting

### Common Issues

**1. MCP Server Not Starting**

Error: `Cannot find module '@modelcontextprotocol/sdk'`
```bash
# Solution: Install dependencies
bun install
```

**2. Permission Denied**

Error: `EACCES: permission denied`
```bash
# Solution: Check file permissions
chmod +x src/mcp-stdio-server.ts
```

**3. Project Root Not Found**

Error: `Project root not found or invalid`
```bash
# Solution: Verify backlog.md project structure
backlog status
# Should show valid project status
```

**4. Tools Not Available in Claude Code**

Possible causes:
- `.mcp.json` not in project root
- MCP server failing to start
- Bun not in PATH

```bash
# Debug steps:
1. Check .mcp.json exists in project root
2. Test server manually: bun run src/mcp-stdio-server.ts
3. Verify bun is accessible: which bun
```

### Debug Mode

Enable detailed logging:

```json
{
  "mcpServers": {
    "backlog-md": {
      "command": "node",
      "args": ["${workspaceFolder}/scripts/mcp-server.cjs"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "${workspaceFolder}",
        "BACKLOG_MCP_DEBUG": "true"
      }
    }
  }
}
```

### Log Files

MCP server logs are written to stderr and visible in Claude Code's output panel.

## Best Practices

### Task Management with Claude

1. **Be Specific**: Provide detailed requirements when asking Claude to create tasks
2. **Use Labels**: Consistently use labels for better organization
3. **Set Priorities**: Always specify priority levels for better sprint planning
4. **Include Acceptance Criteria**: Ask Claude to include testable acceptance criteria

### Workflow Integration

1. **Sprint Planning**: Use Claude for capacity planning and task prioritization
2. **Code Reviews**: Link PRs to tasks for better traceability
3. **Bug Triage**: Let Claude help categorize and prioritize bugs
4. **Documentation**: Ask Claude to create tasks for documentation needs

### Security

1. **Local Only**: The stdio transport is secure for local development
2. **No Network Access**: MCP server doesn't expose network endpoints by default
3. **File Permissions**: Server inherits your local file permissions
4. **Input Validation**: All inputs are validated before processing

## Next Steps

- Explore [API Reference](api-reference.md) for complete tool documentation
- Check out [Usage Examples](examples/) for common patterns
- Review [Workflow Templates](workflows.md) for advanced use cases