# Backlog.md MCP Integration

The backlog.md MCP (Model Context Protocol) server enables AI agents like Claude Code to interact directly with your project tasks, board state, and configuration through a standardized protocol.

## Quick Start with Claude Code

### 1. Verify MCP Server is Ready

```bash
# Ensure dependencies are installed
bun install

# Test the MCP server
bun test src/mcp
```

### 2. Configure Claude Code

Set up MCP configuration for your project:

```bash
# Automatically creates the right .mcp.json for your setup
backlog mcp setup
```

This command:
- Detects if you're in development mode (working on backlog.md source) or using a global installation
- Copies the appropriate template (`.mcp.template.json` or `.mcp.global.template.json`)
- Creates a `.mcp.json` file that Claude Code will automatically detect

The configuration uses a wrapper script that automatically detects whether you're running from source (development mode) or from a global installation, and routes to the appropriate MCP server accordingly.

### 3. Start Using MCP Tools

Once configured, Claude Code will have access to backlog.md functionality:

**Create a task:**
```
Create a new task for implementing user authentication with OAuth2 integration.
Make it high priority with backend and security labels.
```

**Check project status:**
```
Show me the current status of all tasks and any potential blockers.
```

**Plan next sprint:**
```
Help me plan the next 2-week sprint. We have capacity for 20 story points
and want to focus on bug fixes and performance improvements.
```

## Available Features

### 🛠️ **Task Management Tools**
- `task_create` - Create new tasks with full metadata
- `task_update` - Update existing tasks (status, assignee, etc.)
- `task_list` - List and filter tasks by various criteria
- `task_view` - Get detailed task information
- `task_delete` - Archive/delete tasks

### 📊 **Board Management Tools**
- `board_view` - Get current kanban board state
- `board_create` - Create new boards
- `board_update` - Modify board configuration
- `board_list` - List all available boards

### ⚙️ **Configuration Tools**
- `config_get` - Read project configuration
- `config_set` - Update configuration values
- `config_list` - List all configuration options

### 📋 **Sequence Tools**
- `sequence_start` - Begin task sequences
- `sequence_continue` - Progress through sequences
- `sequence_complete` - Mark sequences as done

### 💡 **Workflow Prompts**
- `task_creation_workflow` - Guided task creation from requirements
- `sprint_planning` - Sprint planning assistance with capacity management
- `code_review_integration` - Link code reviews to tasks
- `daily_standup` - Generate standup reports and updates

## Resources Available

### Task Resources
- `task/{id}` - Individual task details in JSON format
- `tasks/status/{status}` - All tasks with specific status
- `tasks/assignee/{assignee}` - Tasks assigned to specific person

### Board Resources
- `board/current` - Current active board state
- `board/{id}` - Specific board configuration
- `boards/list` - All available boards

### Configuration Resources
- `config/current` - Full project configuration
- `config/section/{section}` - Specific config section

## Example Workflows

### Bug Triage Workflow
```
I found a critical bug where users can't login after password reset.
Create a task for this, suggest related testing tasks, and assign appropriate priority.
```

### Feature Planning
```
We want to add real-time notifications to our application.
Break this down into smaller tasks and estimate the complexity.
```

### Sprint Planning
```
Review our backlog and help plan a 2-week sprint focused on user experience.
We have 3 developers and can handle about 25 story points.
```

### Code Review Integration
```
I just opened PR #123 for the authentication refactor.
Link it to the relevant tasks and update their status.
```

## Transport Options

### Stdio Transport (Default)
- **Best for**: Claude Code, local AI tools
- **Security**: Inherits local file system permissions
- **Performance**: Low latency, direct process communication
- **Usage**: Automatically configured via `.mcp.json`

### HTTP Transport
- **Best for**: Web applications, remote agents
- **Security**: Token-based authentication, CORS support
- **Performance**: Network latency, scalable to multiple clients
- **Usage**: `backlog mcp start --transport http --port 3000`

### SSE Transport
- **Best for**: Real-time web applications
- **Security**: Same as HTTP with streaming capabilities
- **Performance**: Server-sent events for real-time updates
- **Usage**: `backlog mcp start --transport sse --port 3000`

## CLI Commands

```bash
# Start MCP server (stdio)
backlog mcp start

# Start with HTTP transport
backlog mcp start --transport http --port 3000 --auth-type bearer --auth-token your-token

# Check server status
backlog mcp status

# Stop running server
backlog mcp stop
```

## Configuration

MCP settings are stored in your project's `config.yml`:

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
      auth:
        type: none
  security:
    inputValidation:
      enabled: true
      strictMode: true
  rateLimiting:
    enabled: true
    maxRequestsPerMinute: 100
```

## Troubleshooting

### Common Issues

**MCP Server Not Starting:**
```bash
# Check if dependencies are installed
bun install

# Verify TypeScript compiles
bunx tsc --noEmit

# Test MCP functionality
bun test src/mcp
```

**Claude Code Can't Find Server:**
- Ensure `.mcp.json` is in your project root
- Check that `bun` is in your PATH
- Verify the project has a valid backlog structure

**Permission Errors:**
- Ensure Claude Code has read access to your project directory
- Check that the `BACKLOG_PROJECT_ROOT` environment variable is set correctly

### Debug Mode

Enable debug logging:
```bash
export BACKLOG_MCP_DEBUG=true
backlog mcp start
```

## Security Considerations

- **Local Access**: Stdio transport inherits your local file permissions
- **Network Access**: HTTP/SSE transports support authentication and CORS
- **Input Validation**: All tool inputs are validated against JSON schemas
- **Rate Limiting**: Configurable limits prevent abuse

## Next Steps

- See [Claude Code Setup Guide](claude-code-setup.md) for detailed configuration
- Check [API Reference](api-reference.md) for complete tool documentation
- Browse [Usage Examples](examples/) for common workflow patterns