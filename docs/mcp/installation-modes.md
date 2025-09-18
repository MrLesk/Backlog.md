# MCP Installation Modes

Backlog.md supports two distinct installation modes for MCP (Model Context Protocol) integration, each optimized for different use cases.

## Overview

The dual-mode system automatically detects your environment and uses the appropriate MCP server configuration:

- **Development Mode**: Running from source code with Bun
- **Global Installation**: Using globally installed `backlog` command

## Development Mode

### When It's Used
- You have the backlog.md source code locally
- Files `src/mcp-stdio-server.ts` and `package.json` exist
- Bun runtime is available

### How It Works
```bash
# MCP wrapper detects development environment
node scripts/mcp-server.cjs
  ↓
# Wrapper spawns Bun to run TypeScript directly
bun run src/mcp-stdio-server.ts
```

### Configuration (`.mcp.json`)
```json
{
  "mcpServers": {
    "backlog-md": {
      "command": "node",
      "args": ["${workspaceFolder}/scripts/mcp-server.cjs"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Advantages
- ✅ **Fast iteration**: Direct TypeScript execution with Bun
- ✅ **Hot reload**: Changes reflected immediately
- ✅ **Full debugging**: Access to source code and stack traces
- ✅ **Latest features**: Always running the most recent code

### Requirements
- **Bun runtime**: Install from [bun.sh](https://bun.sh)
- **Source code**: Clone or fork the backlog.md repository
- **Dependencies**: Run `bun install` to install packages

## Global Installation Mode

### When It's Used
- Backlog.md installed via `npm i -g backlog.md`
- No source code present locally
- Using compiled binary distribution

### How It Works
```bash
# MCP wrapper detects global installation
node scripts/mcp-server.cjs
  ↓
# Wrapper calls global backlog command
backlog mcp start --stdio
```

### Configuration (`.mcp.json`)
```json
{
  "mcpServers": {
    "backlog-md": {
      "command": "backlog",
      "args": ["mcp", "start", "--stdio"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Advantages
- ✅ **Simple setup**: Single npm install command
- ✅ **No dependencies**: Self-contained binary
- ✅ **Cross-platform**: Works on macOS, Linux, Windows
- ✅ **Stable version**: Production-ready releases

### Requirements
- **Node.js**: For npm package management
- **Global install**: `npm install -g backlog.md`
- **PATH access**: `backlog` command available in terminal

## Configuration Management

### Automatic Detection

The `scripts/mcp-server.cjs` wrapper automatically detects your environment:

```javascript
// 1. Check for development mode
if (existsSync('src/mcp-stdio-server.ts') && existsSync('package.json')) {
  // Use: bun run src/mcp-stdio-server.ts
}

// 2. Check for global installation
else if (execSync('backlog --version')) {
  // Use: backlog mcp start --stdio
}

// 3. Error if neither available
else {
  throw new Error('No suitable MCP installation found');
}
```

### Manual Configuration

Use the `backlog mcp setup` command to create appropriate configuration:

```bash
# Auto-detect and create configuration
backlog mcp setup

# Force global configuration (skip auto-detection)
backlog mcp setup --global

# Overwrite existing configuration
backlog mcp setup --force
```

## Switching Between Modes

### Development → Global

1. Install globally:
   ```bash
   npm install -g backlog.md
   ```

2. Update configuration:
   ```bash
   backlog mcp setup --global --force
   ```

3. Test the switch:
   ```bash
   backlog mcp test
   ```

### Global → Development

1. Clone the repository:
   ```bash
   git clone https://github.com/MrLesk/Backlog.md.git
   cd Backlog.md
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Update configuration:
   ```bash
   backlog mcp setup --force
   ```

4. Test the switch:
   ```bash
   backlog mcp test
   ```

## Troubleshooting

### Common Issues

**Development Mode:**
```bash
# Error: "bun command not found"
curl -fsSL https://bun.sh/install | bash

# Error: "src/mcp-stdio-server.ts not found"
# Ensure you're in the correct project directory
ls src/mcp-stdio-server.ts

# Error: "Module not found"
bun install
```

**Global Mode:**
```bash
# Error: "backlog command not found"
npm install -g backlog.md

# Error: "permission denied"
sudo npm install -g backlog.md

# Error: "version mismatch"
npm update -g backlog.md
```

### Diagnostic Commands

```bash
# Check current setup
backlog mcp doctor

# Test connection
backlog mcp test --verbose

# Recreate configuration
backlog mcp setup --force
```

### Mixed Environments

If both development and global installations are present:

- **Priority**: Development mode takes precedence
- **Warning**: `mcp doctor` will show both are available
- **Recommendation**: Use development mode for active development

## Best Practices

### For Developers

1. **Use Development Mode**: When actively working on backlog.md features
2. **Keep Global Backup**: Install globally for other projects
3. **Test Both Modes**: Ensure changes work in production environment
4. **Document Requirements**: Note Bun dependency for team members

### For End Users

1. **Use Global Installation**: Simpler setup and maintenance
2. **Pin Versions**: Use specific versions for production projects
3. **Regular Updates**: Keep global installation current
4. **Test After Updates**: Run `backlog mcp test` after updates

### For CI/CD

```yaml
# Example GitHub Actions setup
- name: Setup Global Installation
  run: npm install -g backlog.md

- name: Test MCP Integration
  run: |
    cd my-project
    backlog mcp setup --global
    backlog mcp test
```

## Architecture Details

### Wrapper Script Pattern

The `scripts/mcp-server.cjs` follows the same pattern as `scripts/cli.cjs`:

1. **CommonJS compatibility**: Works with npm distribution system
2. **Platform detection**: Handles different OS environments
3. **Error handling**: Provides clear diagnostic messages
4. **Process management**: Proper signal handling and cleanup

### Build Integration

Both modes use the same TypeScript source code:

- **Development**: Direct execution with Bun
- **Production**: Compiled into platform binaries
- **Consistency**: Identical functionality in both modes

### Environment Variables

Both modes support the same environment variables:

- `BACKLOG_PROJECT_ROOT`: Override project directory
- `BACKLOG_MCP_DEBUG`: Enable debug logging
- `NODE_ENV`: Set environment mode

This ensures consistent behavior regardless of installation method.