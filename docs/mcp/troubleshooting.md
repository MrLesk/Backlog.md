# MCP Troubleshooting Guide

This guide helps diagnose and resolve common issues with Backlog.md MCP integration.

## Quick Diagnostics

Before diving into specific issues, run these commands to get an overview:

```bash
# Comprehensive diagnostics
backlog mcp doctor

# Test connection
backlog mcp test

# Check installation context
backlog mcp status
```

## Common Issues

### 1. "No MCP servers configured" in Claude Code

**Symptoms:**
- Claude Code shows "No MCP servers configured"
- `/mcp` command returns empty results
- MCP functionality not available

**Causes & Solutions:**

#### Missing `.mcp.json` file
```bash
# Check if file exists
ls -la .mcp.json

# If missing, create it
backlog mcp init
```

#### Wrong directory
```bash
# Ensure you're in the project root
pwd
ls backlog/  # Should show tasks directory

# Navigate to correct directory
cd path/to/your/project
backlog mcp init
```

#### Invalid JSON syntax
```bash
# Validate JSON
cat .mcp.json | jq .

# If invalid, recreate
backlog mcp init --force
```

### 2. "Command not found: bun" (Development Mode)

**Symptoms:**
- MCP wrapper fails with "bun command not found"
- Development mode detected but Bun unavailable
- Server startup fails

**Solution:**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Restart shell or source profile
source ~/.bashrc  # or ~/.zshrc

# Verify installation
bun --version

# Test MCP again
backlog mcp test
```

**Alternative: Switch to Global Mode**
```bash
# Install globally
npm install -g backlog.md

# Reconfigure for global mode
backlog mcp init --global --force
```

### 3. "Command not found: backlog" (Global Mode)

**Symptoms:**
- MCP wrapper fails with "backlog command not found"
- Global mode detected but command unavailable
- CLI commands don't work

**Solution:**
```bash
# Install globally
npm install -g backlog.md

# Check installation
which backlog
backlog --version

# Fix PATH if needed (macOS/Linux)
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.bashrc
source ~/.bashrc

# Windows: Add npm global bin to PATH
npm config get prefix
# Add <prefix>/node_modules/.bin to system PATH
```

### 4. "MCP server startup timed out"

**Symptoms:**
- `backlog mcp test` fails with timeout
- Server takes too long to start
- No response from MCP server

**Diagnosis:**
```bash
# Check for port conflicts (if using HTTP/SSE)
netstat -tlnp | grep 8080

# Test manual startup
bun run src/mcp-stdio-server.ts  # Development
backlog mcp start --stdio        # Global

# Check for dependency issues
bun install  # Development mode
```

**Solutions:**

#### Clear stale processes
```bash
# Kill any running MCP servers
pkill -f "mcp-stdio-server"
pkill -f "backlog.*mcp"

# Clean up PID files
rm -f /tmp/backlog-mcp-server.pid
```

#### Check dependencies
```bash
# Development mode
bun install
bun test src/mcp  # Verify MCP tests pass

# Global mode
npm update -g backlog.md
```

### 5. "Project root not found or invalid"

**Symptoms:**
- MCP server starts but can't access project
- "Invalid backlog project" errors
- Tasks/boards not accessible

**Diagnosis:**
```bash
# Check project structure
backlog status

# Verify backlog directory exists
ls -la backlog/

# Check permissions
ls -la backlog/tasks/
```

**Solutions:**

#### Initialize backlog project
```bash
# If not a backlog project
backlog init "My Project Name"

# If structure is corrupted
backlog doctor
```

#### Fix permissions
```bash
# Ensure read/write access
chmod -R u+rw backlog/
```

#### Environment variable override
```bash
# Override project root in .mcp.json
{
  "mcpServers": {
    "backlog-md": {
      "command": "node",
      "args": ["${workspaceFolder}/scripts/mcp-server.cjs"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "/absolute/path/to/project"
      }
    }
  }
}
```

### 6. "Tool validation failed" Errors

**Symptoms:**
- MCP tools return validation errors
- "Required field missing" messages
- Invalid parameter errors

**Common Validation Issues:**

#### Missing required fields
```javascript
// ❌ Missing title
{ description: "Fix the bug" }

// ✅ Include required title
{ title: "Fix authentication bug", description: "..." }
```

#### Field length limits
```javascript
// ❌ Title too long (>200 chars)
{ title: "Very long title that exceeds the maximum allowed length..." }

// ✅ Reasonable title length
{ title: "Fix authentication bug" }
```

#### Invalid enum values
```javascript
// ❌ Invalid priority
{ priority: "urgent" }

// ✅ Valid priority values
{ priority: "high" }  // high, medium, low
```

### 7. Permission Errors

**Symptoms:**
- "EACCES" permission denied errors
- Can't write to backlog directory
- Configuration file access denied

**Solutions:**

#### Fix file permissions
```bash
# Make scripts executable
chmod +x scripts/mcp-server.cjs

# Fix backlog directory permissions
chmod -R u+rw backlog/

# Fix config file permissions
chmod 644 .mcp.json
```

#### Check parent directory permissions
```bash
# Ensure parent directory is writable
ls -la ../
chmod u+w ../
```

#### Run with appropriate user
```bash
# Don't use sudo for global install
npm install -g backlog.md

# Use sudo only if needed
sudo npm install -g backlog.md
sudo chown -R $USER:$USER ~/.npm
```

## Platform-Specific Issues

### macOS

#### Gatekeeper Issues
```bash
# If Bun is blocked by Gatekeeper
xattr -d com.apple.quarantine $(which bun)

# Or allow in System Preferences > Security & Privacy
```

#### PATH Issues with Different Shells
```bash
# Add to ~/.zshrc (default in macOS Catalina+)
echo 'export PATH="$PATH:~/.bun/bin"' >> ~/.zshrc

# Add to ~/.bash_profile (older macOS)
echo 'export PATH="$PATH:~/.bun/bin"' >> ~/.bash_profile
```

### Windows

#### PowerShell Execution Policy
```powershell
# Check current policy
Get-ExecutionPolicy

# Set to allow scripts (run as admin)
Set-ExecutionPolicy RemoteSigned
```

#### Path Separators
```bash
# Use forward slashes or double backslashes
BACKLOG_PROJECT_ROOT="C:/Users/username/project"
# or
BACKLOG_PROJECT_ROOT="C:\\Users\\username\\project"
```

### Linux

#### Node.js Version Issues
```bash
# Check Node.js version (need 18+)
node --version

# Update via package manager
sudo apt update && sudo apt install nodejs npm
# or use nvm
nvm install --lts
nvm use --lts
```

#### System Package Conflicts
```bash
# Remove system backlog package if conflicts
sudo apt remove backlog

# Use npm version
npm install -g backlog.md
```

## Advanced Debugging

### Enable Debug Mode

#### Environment Variables
```bash
# Enable debug logging
export BACKLOG_MCP_DEBUG=true
backlog mcp start

# Enable verbose test output
backlog mcp test --verbose
```

#### Debug Configuration
```json
// Add debug to .mcp.json
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

### Network Transport Debugging

#### HTTP/SSE Mode Issues
```bash
# Test HTTP transport
backlog mcp start --transport http --port 8080 --debug

# Check port availability
netstat -tlnp | grep 8080
lsof -i :8080

# Test with curl
curl http://localhost:8080/health
```

#### Firewall Issues
```bash
# Allow port in firewall (Linux)
sudo ufw allow 8080

# Check Windows firewall settings
netsh firewall show state
```

### Memory and Performance Issues

#### High Memory Usage
```bash
# Check memory usage
ps aux | grep backlog
top -p $(pgrep backlog)

# Limit memory (if needed)
NODE_OPTIONS="--max-old-space-size=512" backlog mcp start
```

#### Slow Startup
```bash
# Profile startup time
time backlog mcp test

# Check for large task files
find backlog/tasks -name "*.md" -size +1M

# Clear cache if applicable
rm -rf ~/.cache/backlog.md
```

## Getting Help

### Collect Diagnostic Information

When reporting issues, include:

```bash
# System information
uname -a
node --version
bun --version  # if in development mode

# Project information
backlog --version
backlog mcp doctor

# Configuration
cat .mcp.json

# Recent logs
backlog mcp test --verbose 2>&1 | tail -50
```

### Community Support

- **GitHub Issues**: [Report bugs](https://github.com/MrLesk/Backlog.md/issues)
- **Discussions**: [Ask questions](https://github.com/MrLesk/Backlog.md/discussions)
- **Documentation**: [Full docs](https://github.com/MrLesk/Backlog.md/tree/main/docs)

### Emergency Recovery

If MCP is completely broken:

```bash
# Reset MCP configuration
rm .mcp.json
backlog mcp init

# Reinstall global package
npm uninstall -g backlog.md
npm install -g backlog.md

# Reset project (if needed)
rm -rf backlog/.backlogrc
backlog init "Project Name" --force
```

## Prevention

### Regular Maintenance

```bash
# Weekly health check
backlog mcp doctor

# Monthly updates
npm update -g backlog.md

# Backup project before major changes
tar -czf backlog-backup.tar.gz backlog/
```

### Development Best Practices

```bash
# Run tests before major changes
bun test src/mcp

# Keep dependencies updated
bun update

# Use version control
git add .mcp.json
git commit -m "Update MCP configuration"
```