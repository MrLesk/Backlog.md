---
id: task-299
title: 'Fix MCP initialization for multiple AI coding agents (Codex, Gemini, Claude)'
status: Done
assignee:
  - '@codex'
created_date: '2025-10-16 20:07'
updated_date: '2025-10-17 19:22'
labels:
  - mcp
  - init
  - multi-agent-support
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

When users initialize Backlog MCP on multiple projects, Codex CLI shows "1 success + N failures" because it uses global-only configuration and tries to start ALL registered MCP servers in EVERY project. Claude Code doesn't have this issue because it supports project-scoped configuration.

The root cause: Codex has no project-scope support, so when you register `backlog-project1` and `backlog-project2` globally, both try to start everywhere but only one finds the correct `backlog/` folder.

## Solution

Register ONE global `backlog` server that auto-detects its context:
- If `backlog/` folder exists → start normally with full tools
- If not → start successfully but only provide `backlog://init-required` resource that instructs the agent to tell the user to run `backlog init`

This works universally across Claude, Codex, and Gemini.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When user opens Codex in a project with multiple backlog projects configured, all MCP servers start successfully (0 failures, N successes)
- [x] #2 MCP server starts successfully in non-backlog directories and provides backlog://init-required resource
- [x] #3 backlog://init-required resource contains instructions for agent to tell user to run backlog init
- [x] #4 All agents register single global 'backlog' server name (not per-project names)
- [x] #5 Init command updated to register global scope for all agents

- [x] #6 Manual testing confirms: 3 projects (2 with backlog), 1 global server registration, all agents show 1 success + 0 failures

- [x] #7 Migration guide added for users with existing backlog-project* registrations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Approach

**1. MCP Server Auto-Detection**

When `backlog mcp start` runs:
1. Check if `backlog/config.yml` exists in CWD
2. If YES → start normally, serve full tools and resources
3. If NO → start successfully but only provide `backlog://init-required` resource

**2. Fallback Resource**

Provide this resource when backlog is not initialized:
```json
{
  "uri": "backlog://init-required",
  "name": "Backlog.md Not Initialized",
  "description": "Instructions for initializing Backlog.md in this project",
  "mimeType": "text/markdown"
}
```

Content instructs the agent: "Tell the user to run `backlog init` to set up task management for this project."

**3. Universal Agent Configuration**

All agents register identically:
```bash
# Claude Code
claude mcp add backlog --command backlog --args "mcp,start" --scope user

# Codex
codex mcp add backlog --command backlog --args "mcp,start"

# Gemini
gemini mcp add backlog -s user --command backlog --args "mcp,start"
```

**4. Implementation Files**

- `src/mcp/server.ts` - Add startup detection logic
- `src/commands/init.ts` - Change to global `backlog` server registration
- `src/mcp/resources/` - Add `init-required` resource

**5. Testing Strategy**

Manual verification in multi-project setup:
- 3 projects, backlog initialized in 2
- Register global server, test each agent
- Verify: 1 success per agent, 0 failures
- Verify fallback resource appears in non-backlog projects
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research Findings (2025-10-16)

### 1. Claude Code - Multi-Scope System (Most Flexible)

**Configuration Scopes:**
- **Local Scope** (default): Project-specific user settings, private to individual developers
- **Project Scope**: `.mcp.json` at project root, version-controlled, team-shared
- **User Scope**: Global across all projects, private to user account

**Configuration Files:**
- Project: `.mcp.json` (at project root)
- User: `~/.claude.json` or `~/.claude/settings.local.json`

**Scope Precedence:** Local → Project → User

**Key Features:**
- Environment variable expansion: `${VAR}` and `${VAR:-default}`
- Security approval prompts for project-scoped servers
- Version control friendly with `.mcp.json`

**Why it works for Backlog:** When running `claude mcp add backlog-{project-name}`, Claude Code likely respects the current working directory and adds the server with project scope, preventing cross-project interference.

---

### 2. OpenAI Codex CLI - Global Only (Problematic)

**Configuration Approach:**
- **Fully global** - NO project-specific configuration support
- Single config file: `~/.codex/config.toml`
- Shared between CLI and VSCode extension

**Multi-Project Handling:**
- All MCP servers are available to ALL projects simultaneously
- No built-in mechanism for project-specific servers
- When you add multiple `backlog-{project-name}` servers, ALL attempt to start in EVERY project

**Why it causes failures:** 
- Codex tries to initialize ALL registered MCP servers regardless of current directory
- Each `backlog mcp start` command tries to run in context of current project
- Only the one matching the current project succeeds; others fail (wrong CWD)

**Configuration Format (TOML):**
```toml
[mcp_servers.backlog-project1]
command = "backlog"
args = ["mcp", "start"]

[mcp_servers.backlog-project2]
command = "backlog"
args = ["mcp", "start"]
```

---

### 3. Gemini CLI - Dual Scope (Flexible)

**Configuration Scopes:**
- **User-level (global):** `~/.gemini/settings.json`
- **Project-level:** `.gemini/settings.json` (in project directory)

**Configuration Method:**
- `gemini mcp add <server> -s user` (global)
- `gemini mcp add <server> -s project` (project-specific)

**Multi-Project Handling:**
- Supports both global and project-specific servers
- Scope-based configuration similar to Claude Code
- Can maintain shared configs globally + project-specific overrides

**Key Features:**
- FastMCP integration: `fastmcp install gemini-cli`
- OAuth 2.0 for remote servers
- Docker MCP Toolkit support

---

## The Root Cause

The problem occurs specifically with **Codex** because:

1. **Codex uses global-only configuration** - all MCP servers are registered globally
2. When you run `backlog init` on Project A, it adds `backlog-projectA` to `~/.codex/config.toml`
3. When you run `backlog init` on Project B, it adds `backlog-projectB` to `~/.codex/config.toml`
4. Now Codex tries to start BOTH servers in EVERY project, but:
   - `backlog mcp start` reads from the current directory's `backlog/` folder
   - Only ONE project has the right backlog structure
   - Result: 1 success + N failures

**Claude Code and Gemini CLI don't have this issue** because they support project-scoped configuration, so each project only initializes its own MCP server.

---

## Problem Scenarios

**Scenario 1: User has 3 projects with Backlog + Codex**
```
~/.codex/config.toml contains:
[mcp_servers.backlog-project1]
[mcp_servers.backlog-project2]  
[mcp_servers.backlog-project3]

When Codex starts in project1:
- Tries to init backlog-project1 ✅ SUCCESS (finds backlog/ folder)
- Tries to init backlog-project2 ❌ FAIL (wrong directory)
- Tries to init backlog-project3 ❌ FAIL (wrong directory)
```

**Scenario 2: Same setup with Claude Code**
```
Each project has its own .mcp.json:
project1/.mcp.json → backlog-project1
project2/.mcp.json → backlog-project2
project3/.mcp.json → backlog-project3

When Claude starts in project1:
- Only reads project1/.mcp.json
- Only tries to init backlog-project1 ✅ SUCCESS
```

---

## Official Documentation Sources

- **Claude Code MCP**: https://docs.claude.com/en/docs/claude-code/mcp
- **Codex MCP**: https://developers.openai.com/codex/mcp/
- **Gemini CLI MCP**: https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html

### Implementation Summary (2025-10-17)
- Added fallback detection in `src/mcp/server.ts` so the server exposes only `backlog://init-required` when invoked outside an initialized project and boots normally otherwise.
- Introduced `src/mcp/resources/init-required` plus `src/guidelines/mcp/init-required.md` and wired the guide through `MCP_INIT_REQUIRED_GUIDE` for MCP resources and tests.
- Simplified CLI registration by replacing the per-project server name helper with a shared `MCP_SERVER_NAME = "backlog"`, ensuring all agents register the same global MCP target during `backlog init`.
- Expanded automated coverage with the new `src/test/mcp-fallback.test.ts` suite and refreshed existing MCP server and task integration tests to exercise the fallback path.
- Manually validated fallback mode and global registration idempotency: started the server from an uninitialized temp directory via Inspector stdio, and reran `claude/codex/gemini mcp add backlog -- backlog mcp start` + respective list commands to confirm duplicate adds report "already configured" without extra entries.
- Ran the full regression pack with `bun test` to ensure the broader CLI surface still passes.
<!-- SECTION:NOTES:END -->
