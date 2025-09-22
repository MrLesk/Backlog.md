# MCP Development Setup Guide

**Self-contained, workspace-isolated MCP development for Backlog.md**

This guide walks you through setting up a completely local MCP development environment that doesn't rely on global installations and supports multiple parallel workspaces. Works with both **Claude CLI** and **Claude Desktop**.

## Quick Start (< 30 seconds)

### Auto-Detection (Recommended)
```bash
# Clone and setup - automatically detects your Claude environment
git clone <your-repo-url> backlog-workspace-1
cd backlog-workspace-1
bun install                    # Smart CLI detection auto-configures development
./scripts/setup-mcp-dev.sh     # Configure MCP server

# For Claude CLI: run `claude`
# For Claude Desktop: open directory in Claude Desktop
```

> **Note**: The project now features smart CLI detection! After `bun install`, the CLI automatically uses TypeScript source files in development, eliminating version conflicts.

### Manual Mode Selection
```bash
# Force Claude CLI mode
./scripts/setup-mcp-dev.sh --cli

# Force Claude Desktop mode
./scripts/setup-mcp-dev.sh --desktop
```

That's it! The MCP server is now ready for development and testing.

## Claude CLI vs Claude Desktop

The setup script automatically detects your Claude environment and configures accordingly:

| Feature | Claude CLI | Claude Desktop |
|---------|------------|----------------|
| **Configuration** | Uses `claude mcp add` command | Creates `.mcp.json` file |
| **Path Format** | Absolute paths | `${workspaceFolder}` variables |
| **Server Registration** | Explicit CLI registration | Auto-detection on folder open |
| **Management** | `claude mcp list/remove` | File-based configuration |
| **Multi-workspace** | Separate CLI registrations | Separate `.mcp.json` files |

### Switching Between Modes

You can switch modes at any time:

```bash
# Switch to CLI mode
./scripts/setup-mcp-dev.sh --cli

# Switch to Desktop mode
./scripts/setup-mcp-dev.sh --desktop

# Auto-detect mode (default)
./scripts/setup-mcp-dev.sh
```

## What Gets Created

The setup script creates a fully isolated workspace:

```
backlog-workspace-1/
├── .mcp.json              # Claude Code MCP server config (workspace-specific)
├── .env.mcp               # Environment variables (with unique workspace ID)
├── MCP_DEV_README.md      # Quick reference for this workspace
└── [existing project files]
```

### Generated Files

#### `.mcp.json`
The format varies based on your Claude environment:

**Claude CLI Format** (absolute paths):
```json
{
  "mcpServers": {
    "backlog-md-dev-abc12345": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "/absolute/path/to/src/mcp-stdio-server.ts"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "/absolute/path/to/workspace",
        "BACKLOG_MCP_DEBUG": "true",
        "BACKLOG_MCP_WORKSPACE_ID": "abc12345"
      }
    }
  }
}
```

**Claude Desktop Format** (workspace variables):
```json
{
    "mcpServers": {
        "backlog-md-dev-abc12345": {
            "command": "bun",
            "args": ["run", "${workspaceFolder}/src/mcp-stdio-server.ts"],
            "env": {
                "BACKLOG_PROJECT_ROOT": "${workspaceFolder}",
                "BACKLOG_MCP_DEBUG": "true",
                "BACKLOG_MCP_WORKSPACE_ID": "abc12345"
            }
        }
    }
}
```

#### `.env.mcp`
Workspace-specific environment variables:
```bash
BACKLOG_MCP_WORKSPACE_ID=abc12345
BACKLOG_PROJECT_ROOT=/path/to/workspace
BACKLOG_MCP_DEBUG=true
BACKLOG_MCP_LOG_LEVEL=debug
```

## CLI Detection for MCP Development

The Backlog.md CLI now includes smart detection that automatically adapts to your development environment. This is particularly important for MCP development where you need the CLI to use the latest source code.

### How It Works

When you run `backlog` commands during MCP development:

1. **Auto-Detection**: CLI detects you're in a development environment (source files present, no platform binaries)
2. **Source Mode**: Automatically uses `bun src/cli.ts` instead of old platform binaries
3. **Live Updates**: Changes to source files are immediately available without rebuilds

### Benefits for MCP Development

- **No Version Conflicts**: Always uses your current development code
- **Instant Feedback**: MCP tools reflect your latest changes immediately
- **Zero Configuration**: Works automatically after `bun install`

### Debug Mode

If you encounter issues with CLI detection during MCP development:

```bash
export BACKLOG_DEBUG=true
backlog --version  # Shows detection logic and chosen execution mode
```

## Prerequisites

- **Bun**: Primary runtime for the project (required for development mode)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Node.js**: Optional but recommended for compatibility
- **Git**: For cloning repositories

## Multiple Workspaces

You can have multiple Backlog.md workspaces running simultaneously:

```bash
# Workspace 1 - main development
git clone <repo> backlog-main
cd backlog-main
./scripts/setup-mcp-dev.sh

# Workspace 2 - feature branch
git clone <repo> backlog-feature-x
cd backlog-feature-x
git checkout feature-x
./scripts/setup-mcp-dev.sh

# Workspace 3 - testing
git clone <repo> backlog-testing
cd backlog-testing
./scripts/setup-mcp-dev.sh
```

Each workspace gets:
- Unique workspace ID (prevents conflicts)
- Separate MCP server instance
- Independent environment variables
- Isolated debugging and logging

## Testing Your Setup

### Manual Testing
```bash
# Test MCP server directly
bun run src/mcp-stdio-server.ts
# Should show startup message on stderr, then wait for input

# Press Ctrl+C to stop
```

### Automated Testing (once test script is created)
```bash
./scripts/test-mcp-setup.sh
```

### Claude Code Integration Test

1. Open the workspace directory in Claude Code
2. Verify MCP server appears in the server list (named like `backlog-md-dev-abc12345`)
3. Test basic functionality:

**Create a test task:**
```
Create a new task called "Test MCP integration" with description "Verify that MCP server is working correctly"
```

**List current tasks:**
```
Show me all current tasks in the backlog
```

**View board state:**
```
Display the current kanban board status
```

## Available MCP Tools

Once connected, Claude has access to these tools:

### Task Management
- `task_create` - Create new tasks
- `task_list` - List tasks with filtering
- `task_edit` - Edit task properties
- `task_delete` - Delete tasks

### Board Operations
- `board_view` - View kanban board status
- `board_move` - Move tasks between columns

### Configuration
- `config_get` - Get configuration values
- `config_set` - Set configuration values
- `config_list` - List all configuration

### Sequences & Planning
- `sequence_create` - Create task sequences
- `sequence_list` - List sequences
- `sequence_execute` - Execute sequence workflows

### Workflow Prompts
- `task_creation_workflow` - Guided task creation
- `sprint_planning_workflow` - Sprint planning assistance
- `code_review_workflow` - Code review integration

## Troubleshooting

### MCP Server Not Starting

**Error: `Cannot find module '@modelcontextprotocol/sdk'`**
```bash
# Ensure dependencies are installed
bun install
```

**Error: `bun: command not found`**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
# Restart your terminal or source your shell profile
```

**Error: `Project root not found or invalid`**
```bash
# Verify you're in a valid Backlog.md project
ls -la  # Should see package.json, src/, etc.

# Check environment
cat .env.mcp  # Should have BACKLOG_PROJECT_ROOT set
```

### Claude Code Issues

**MCP server not detected:**
1. Verify `.mcp.json` exists in project root
2. Restart Claude Code
3. Check Claude Code's MCP server status

**Tools not available:**
1. Check MCP server logs (they go to stderr)
2. Verify server started without errors:
   ```bash
   bun run src/mcp-stdio-server.ts
   ```
3. Run setup script again:
   ```bash
   ./scripts/setup-mcp-dev.sh  # Will detect existing files
   ```

**Permission errors:**
```bash
# Make sure scripts are executable
chmod +x scripts/*.sh
```

### Debug Mode

All development setups include debug mode by default. Check logs:

```bash
# Server logs go to stderr
bun run src/mcp-stdio-server.ts 2>&1 | tee mcp-debug.log
```

Environment variables for debugging:
```bash
export BACKLOG_MCP_DEBUG=true
export BACKLOG_MCP_LOG_LEVEL=debug
```

## Best Practices

### Development Workflow

1. **Use workspace branches**: Keep each workspace on a different branch
2. **Test in isolation**: Each workspace has independent state
3. **Debug locally**: Use `bun run src/mcp-stdio-server.ts` for direct testing
4. **Environment consistency**: Don't modify generated `.env.mcp` unless needed

### Task Creation with Claude

When working with Claude via MCP:

1. **Be specific**: Provide detailed requirements for task creation
2. **Use consistent labels**: Helps with organization and filtering
3. **Include acceptance criteria**: Makes tasks more actionable
4. **Set priorities**: Helps with sprint planning

### Security

- **Local only**: All communication stays on your machine
- **No network exposure**: Default setup uses stdio transport only
- **File permissions**: MCP server inherits your local file permissions
- **Workspace isolation**: Each workspace is completely independent

## Advanced Configuration

### Custom Environment Variables

Edit `.env.mcp` to add custom settings:

```bash
# Custom debug settings
BACKLOG_MCP_VERBOSE=true
BACKLOG_MCP_TRACE_REQUESTS=true

# Custom paths
BACKLOG_MCP_CONFIG_DIR=./custom-config
BACKLOG_MCP_DATA_DIR=./custom-data
```

### HTTP Transport (Optional)

For advanced use cases, you can modify `.mcp.json` to use HTTP transport:

```json
{
    "mcpServers": {
        "backlog-md-dev-http": {
            "command": "bun",
            "args": [
                "run", "src/cli.ts", "mcp", "start",
                "--transport", "http",
                "--port", "8080"
            ],
            "env": {
                "BACKLOG_PROJECT_ROOT": "${workspaceFolder}"
            }
        }
    }
}
```

### Custom MCP Server Modifications

The entry point is `src/mcp-stdio-server.ts`. Modify this file to:
- Add custom tools
- Modify existing behavior
- Add custom prompts
- Integrate with external services

## Next Steps

1. **Explore the codebase**: Check out `src/mcp/` for server implementation
2. **Add custom tools**: Extend the MCP server with project-specific functionality
3. **Create workflows**: Use MCP prompts to automate common tasks
4. **Share configurations**: Save workspace setups for different development scenarios

## Related Documentation

- [MCP Architecture](../README.md) - Understanding the MCP implementation
- [Claude Code Setup](claude-code-setup.md) - Production setup guide
- [API Reference](api-reference.md) - Complete tool documentation
- [Usage Examples](examples/) - Common patterns and workflows