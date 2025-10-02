# MCP Security Guidelines

⚠️ **CRITICAL: Local Development Only**

The Backlog.md MCP server is designed **EXCLUSIVELY** for local development on `localhost` (127.0.0.1).

## Why This Restriction Exists

The MCP server has:

- ❌ **No authentication** - anyone can connect
- ❌ **No authorization** - all operations permitted to all clients
- ❌ **No encryption** - data transmitted in plain text (stdio/HTTP)
- ❌ **No audit logging** - no record of who performed what actions
- ❌ **No rate limiting by user** - process-level limits only
- ❌ **No input sanitization for multi-user scenarios** - assumes single trusted user

**If exposed to a network**, anyone who can reach the server can:

- Read all your tasks, including confidential information
- Modify or delete any task without restriction
- Create malicious tasks
- Access your project's filesystem (within project boundaries)
- Exhaust system resources through excessive requests

## Safe Usage

### ✅ DO:

- **Use stdio transport** (default) - provides maximum process isolation
- **Use HTTP/SSE only on localhost** - bind to `127.0.0.1` or `localhost` explicitly
- **Run on your local development machine** - never on shared or remote systems
- **Connect local AI assistants** - Claude Code, Claude Desktop, Google Gemini CLI, OpenAI Codex, or other MCP-compatible tools
- **Use for personal task management** - single-user workflows only

### ❌ DO NOT:

- **Bind to `0.0.0.0`** or any public IP address
- **Expose to your home network** - even "trusted" networks can be compromised
- **Expose to company networks** - security policies likely prohibit this
- **Deploy to the internet** - immediate security compromise
- **Use in production** - no authentication/authorization model exists
- **Use in multi-user scenarios** - designed for single developer only
- **Deploy to containers, VMs, or cloud platforms** - if others can reach it, it's unsafe

## What If I Made a Mistake?

If you accidentally exposed the MCP server to a network:

### Immediate Actions

1. **Stop the server immediately**:
   ```bash
   pkill -f "backlog mcp"
   # or press Ctrl+C if running in foreground
   ```

2. **Assess the exposure duration**:
   ```bash
   # Check if server was running
   ps aux | grep "backlog mcp"

   # Check system logs for connection attempts
   tail -100 ~/.backlog/mcp.log  # if logging enabled
   ```

3. **Review recent changes**:
   ```bash
   # Check git history for unauthorized modifications
   git log --all --oneline --since="1 hour ago"

   # Check for new/modified tasks
   git status
   git diff HEAD
   ```

4. **Audit your tasks**:
   ```bash
   # List recently modified tasks
   backlog task list --limit 50

   # Search for suspicious content
   grep -r "password\|token\|secret\|api_key" backlog/tasks/
   ```

### Damage Control

5. **Rotate credentials** if any were stored in task descriptions:
   - API keys
   - Passwords
   - Access tokens
   - SSH keys
   - Database credentials

6. **Review acceptance criteria and notes** for sensitive data exposure

7. **Check for malicious tasks**:
   ```bash
   # Look for tasks created recently
   find backlog/tasks -name "*.md" -mtime -1
   ```

### Recovery

8. **Restart safely**:
   ```bash
   # Explicitly bind to localhost
   backlog mcp start --transport stdio

   # Or for HTTP/SSE (localhost only)
   backlog mcp start --transport http --host 127.0.0.1 --port 3000
   ```

9. **Enable debug logging** (for future monitoring):
   ```bash
   export BACKLOG_MCP_DEBUG=true
   backlog mcp start
   ```

### If Exposed to Internet

If the server was exposed to the **internet** (not just your local network):

- **Consider all task data compromised** - assume attackers accessed everything
- **Follow your organization's security incident response plan** - if applicable
- **Document the incident** - timeline, exposure duration, actions taken
- **Consider creating new git repository** - if sensitive data was committed

## Transport-Specific Guidance

### Stdio Transport (Recommended)

**Security Level**: ⭐⭐⭐⭐⭐ (Maximum Isolation)

```bash
backlog mcp start --transport stdio
```

**How it works:**
- Direct process-to-process communication
- No network sockets opened
- No way to expose accidentally
- Used by: Claude Code, Claude Desktop, Google Gemini CLI, OpenAI Codex, and other MCP clients

**Best for:**
- Default choice for all users
- Maximum security with zero network exposure
- AI assistants that support stdio MCP

### HTTP Transport (Localhost Only)

**Security Level**: ⭐⭐⭐ (Localhost Binding Required)

```bash
backlog mcp start --transport http --host 127.0.0.1 --port 3000
```

**How it works:**
- HTTP server bound to localhost
- Runtime validation prevents non-localhost binding
- Basic token authentication (prevents accidental cross-process access)

**Best for:**
- Local browser-based tools requiring HTTP
- Testing MCP over HTTP locally
- Tools that don't support stdio

**Risks:**
- Port conflicts with other local services
- Browser extensions might access if token leaked
- Firewall rules could accidentally expose port

**Mitigations:**
- Always use `--host 127.0.0.1` explicitly
- Use non-standard ports (3000-3999 recommended)
- Use auth tokens: `--auth-type bearer --auth-token $(uuidgen)`

### SSE Transport (Localhost Only)

**Security Level**: ⭐⭐⭐ (Localhost Binding Required)

```bash
backlog mcp start --transport sse --host 127.0.0.1 --port 3000
```

**How it works:**
- Server-Sent Events for real-time updates
- Same localhost binding as HTTP
- Long-lived connections for streaming

**Best for:**
- Local browser tools requiring real-time updates
- WebSocket alternative for local development
- Dashboard or monitoring tools running locally

**Same risks and mitigations as HTTP transport**

## Configuration Best Practices

### Default Configuration (Safest)

```yaml
# config.yml
mcp:
  enabled: true
  transports:
    stdio:
      enabled: true    # Always safe
    http:
      enabled: false   # Disable if not needed
      host: "127.0.0.1"
      port: 3000
    sse:
      enabled: false   # Disable if not needed
      host: "127.0.0.1"
      port: 3001
```

### For Claude Code

```json
// .mcp.json
{
  "mcpServers": {
    "backlog-md": {
      "command": "backlog",
      "args": ["mcp", "start", "--transport", "stdio"],
      "env": {
        "BACKLOG_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### For Browser-Based Local Tools

Only if you absolutely need HTTP:

```bash
# Generate random token
TOKEN=$(uuidgen)

# Start with authentication
backlog mcp start \
  --transport http \
  --host 127.0.0.1 \
  --port 3000 \
  --auth-type bearer \
  --auth-token "$TOKEN"

# Save token securely
echo "MCP_TOKEN=$TOKEN" >> .env.local
chmod 600 .env.local
```

## Network Exposure Detection

### Check If Server Is Exposed

```bash
# Check what interfaces server is bound to
netstat -tlnp | grep $(pgrep -f "backlog mcp")

# Should show: 127.0.0.1:3000 LISTEN
# Should NOT show: 0.0.0.0:3000 LISTEN
```

### Monitor for External Connections

```bash
# Watch for connections (should only see localhost)
watch -n 1 'netstat -tn | grep :3000'

# Any IP other than 127.0.0.1 is suspicious
```

## Developer Guidance

### For Project Contributors

If you're developing backlog.md itself:

- **Never commit credentials** in test fixtures
- **Document security assumptions** in code comments
- **Test localhost binding** in transport tests
- **Don't add network features** without security review
- **Keep MCP scope limited** to local development use case

### For Integration Developers

If you're integrating backlog.md MCP into your tool:

- **Default to stdio** if your tool supports it
- **Validate localhost binding** if using HTTP/SSE
- **Don't bypass security checks** in transport code
- **Document security model** for your users
- **Consider sandboxing** MCP server process

## Frequently Asked Questions

### "Can I use this in a Docker container?"

Only if:
- Container runs on your local machine only
- No port forwarding to host or external networks
- You understand the container is still local development

### "Can I expose this to my team on internal network?"

**No.** There is no authentication/authorization system suitable for multi-user access.

### "What about using a VPN?"

**No.** VPN doesn't change the fact that MCP has no access controls.

### "Can I add authentication and then deploy it?"

**Not recommended.** The entire architecture assumes single trusted user. Adding authentication wouldn't address:
- Lack of authorization (who can do what)
- Lack of audit logging (who did what when)
- Lack of rate limiting per user
- Lack of input sanitization for adversarial scenarios

If you need networked access, consider:
- Building a separate REST API with proper authentication
- Using git-based workflows for collaboration
- Deploying a purpose-built task management system

### "Why not just add authentication?"

Because MCP is designed as a **local protocol wrapper**, not a networked application:

1. **Architecture**: Direct Core API calls with no permission model
2. **Performance**: No overhead for auth checks (assumes trusted caller)
3. **Simplicity**: Focus on protocol translation, not user management
4. **Scope**: Intentionally limited to single-user local development

Adding network security would require fundamental redesign.

## Summary

✅ **MCP is safe when used as designed**: localhost only, single developer, local AI assistants

❌ **MCP is unsafe when exposed to networks**: no authentication, no authorization, no security model

🔒 **Key principle**: If anyone other than you can reach the MCP server, it's a security risk.

## Getting Help

- **Documentation**: [MCP README](README.md)
- **Issues**: [GitHub Issues](https://github.com/MrLesk/Backlog.md/issues)
- **Security Concerns**: Open a GitHub issue with `[SECURITY]` prefix

---

*Last updated: 2025-09-30*
