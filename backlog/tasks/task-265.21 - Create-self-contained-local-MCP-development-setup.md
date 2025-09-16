---
id: task-265.21
title: Create self-contained local MCP development setup
status: Done
assignee:
  - radleta
created_date: '2025-09-16 14:18'
completed_date: '2025-09-16 15:30'
labels:
  - mcp
  - development
  - automation
dependencies: []
parent_task_id: task-265
priority: medium
---

## Description

Implement frictionless, automated setup for developers to run Backlog.md MCP server locally without relying on global CLI installation, supporting multiple parallel workspaces.

## Requirements

- One-command setup script (scripts/setup-mcp-dev.sh)
- Auto-detect OS and environment
- Check prerequisites (bun, node)
- Install dependencies locally
- Generate workspace-specific .mcp.json
- Create .env.mcp for workspace isolation
- Provide clear success/failure feedback

## Implementation Details

### Setup Script Features
- Auto-detect OS and environment
- Check prerequisites (bun, node)
- Install dependencies locally
- Generate workspace-specific .mcp.json
- Create .env.mcp for workspace isolation
- Provide clear success/failure feedback

### Developer Documentation
- Quick start (one command setup)
- Prerequisites checklist
- Troubleshooting guide
- Testing instructions
- Multiple workspace guide

### Workspace Isolation
- Generate unique workspace ID for each setup
- Use environment variables for port/socket isolation
- Support running multiple MCP servers simultaneously
- Create workspace-specific config directory

### Configuration Templates
- Create .mcp.dev.json template specifically for local development
- Use bun run directly instead of global CLI
- Include debug settings by default
- Add workspace-specific environment variables

### Testing & Validation
- Verify MCP server starts correctly
- Test basic tool functionality
- Check Claude Code integration
- Validate workspace isolation

## Developer Experience Goal
1. Clone & Setup (< 30 seconds): git clone <repo> && cd backlog.md && ./scripts/setup-mcp-dev.sh
2. Automatic setup with validation
3. Claude Code integration ready immediately
4. Multiple workspaces supported without conflicts

## Implementation Results

### ✅ Files Created/Modified

1. **`scripts/setup-mcp-dev.sh`** - Dual-mode setup script (~420 lines)
   - **Dual-mode detection**: Automatically detects Claude CLI vs Claude Desktop
   - **Claude CLI support**: Uses `claude mcp add` with absolute paths
   - **Claude Desktop support**: Creates `.mcp.json` with `${workspaceFolder}` variables
   - **Mode override**: `--cli` and `--desktop` flags to force specific modes
   - Auto-detection of environment and dependencies (bun, node)
   - Workspace isolation with unique 8-character IDs (e.g., f10615ab)
   - Port allocation for future HTTP transport (8080-8130 range)
   - Re-initialization detection with user confirmation
   - Comprehensive logging with colored output and error handling
   - Creates: `.mcp.json`, `.env.mcp`, `MCP_DEV_README.md`

2. **`docs/mcp/dev-setup.md`** - Complete dual-mode documentation (~350 lines)
   - **Claude CLI vs Desktop comparison table**
   - Quick start guide with auto-detection (< 30 seconds setup)
   - Manual mode selection (`--cli`/`--desktop` flags)
   - Multiple workspace setup instructions
   - Comprehensive troubleshooting guide
   - Available MCP tools reference
   - Security and best practices
   - Advanced configuration options

3. **`.mcp.dev.template.json`** - Development template with workspace ID placeholders
   - Uses `bun run` directly (no global CLI dependency)
   - Debug settings enabled by default
   - Workspace-specific environment variables
   - Template variable substitution (`{{WORKSPACE_ID}}`)

4. **`.mcp.desktop.template.json`** - Claude Desktop specific template
   - Uses `${workspaceFolder}` variables for path resolution
   - Compatible with Claude Desktop auto-detection
   - Workspace-specific environment variables
   - Template variable substitution (`{{WORKSPACE_ID}}`)

5. **`scripts/test-mcp-setup.sh`** - Comprehensive validation script (8 tests)
   - Prerequisites check (bun, node)
   - Project structure validation
   - Dependencies verification (MCP SDK)
   - Configuration files validation (JSON parsing)
   - MCP server startup test (3-second timeout)
   - TypeScript compilation check
   - MCP tools compilation verification
   - Workspace isolation validation

6. **`scripts/mcp-server.cjs`** - Enhanced wrapper script
   - Added `loadWorkspaceEnvironment()` function for `.env.mcp` support
   - Workspace isolation logging (workspace ID display)
   - Updated help documentation with new environment variables
   - Better error messages pointing to setup script

7. **`.gitignore`** - Updated with MCP workspace files
   - Added `.env.mcp` (workspace-specific environment)
   - Added `MCP_DEV_README.md` (generated per-workspace docs)
   - Ensures workspace isolation doesn't leak to git

### ✅ Key Features Implemented

- **Dual-mode detection**: Automatically detects Claude CLI vs Claude Desktop
- **Claude CLI support**: Uses `claude mcp add` command with absolute paths
- **Claude Desktop support**: Creates `.mcp.json` with `${workspaceFolder}` variables
- **Mode override**: `--cli` and `--desktop` flags to force specific modes
- **One-command setup**: `./scripts/setup-mcp-dev.sh` - complete setup in < 30 seconds
- **Workspace isolation**: Each workspace gets unique ID, port allocation, environment
- **No global dependencies**: Uses `bun run src/mcp-stdio-server.ts` directly
- **Multiple parallel workspaces**: Full isolation prevents conflicts
- **Automated validation**: 8-test validation script with 100% pass rate
- **Re-initialization handling**: Detects existing setup, prompts user
- **Port management**: Auto-allocates ports (8080-8130) for future HTTP transport
- **Environment isolation**: `.env.mcp` with workspace-specific variables

### ✅ Generated Workspace Files

Each workspace gets:
```
workspace/
├── .mcp.json              # Claude Code config (workspace-specific server name)
├── .env.mcp               # Environment variables (workspace ID, ports, debug)
└── MCP_DEV_README.md      # Quick reference for this workspace
```

### ✅ Developer Experience Achieved

**Setup Flow:**
```bash
git clone <repo> my-workspace
cd my-workspace
./scripts/setup-mcp-dev.sh    # < 30 seconds
# Open in Claude Code → MCP server auto-detected → Ready!
```

**Validation:**
```bash
./scripts/test-mcp-setup.sh   # 8 tests, detailed reporting
```

**Multiple Workspaces:**
```bash
# Each workspace is completely isolated
git clone <repo> workspace-1 && cd workspace-1 && ./scripts/setup-mcp-dev.sh
git clone <repo> workspace-2 && cd workspace-2 && ./scripts/setup-mcp-dev.sh
# Both can run simultaneously without conflicts
```

### ✅ Testing Results

All requirements tested successfully:
- ✅ Setup script works on first run
- ✅ Re-initialization handling works (prompts user)
- ✅ Validation script passes all 8 tests (100% success rate)
- ✅ MCP server starts correctly
- ✅ Workspace isolation functional (unique IDs, ports)
- ✅ **Claude CLI mode tested and working** (absolute paths)
- ✅ **Claude Desktop mode tested and working** (`${workspaceFolder}` variables)
- ✅ **Auto-detection functioning correctly** (CLI vs Desktop)
- ✅ **Mode override flags working** (`--cli`/`--desktop`)
- ✅ TypeScript compilation passes
- ✅ MCP tools compilation successful

### 🎯 Goals Achieved

1. **< 30 seconds setup** ✅ - Automated script handles everything
2. **Self-contained** ✅ - No global CLI dependencies
3. **Workspace isolation** ✅ - Unique IDs, ports, environment
4. **Multiple workspaces** ✅ - Full parallel workspace support
5. **Low friction** ✅ - One command setup with validation
6. **Clear documentation** ✅ - Comprehensive dev guide with troubleshooting

## Deliverables ✅ Complete

- ✅ `scripts/setup-mcp-dev.sh` (dual-mode setup) - ~420 lines with CLI/Desktop support
- ✅ `scripts/test-mcp-setup.sh` (validation script) - 8 comprehensive tests
- ✅ `docs/mcp/dev-setup.md` (dual-mode documentation) - ~350 lines with CLI/Desktop comparison
- ✅ `.mcp.dev.template.json` (dev-specific template) - workspace ID substitution
- ✅ `.mcp.desktop.template.json` (Desktop-specific template) - `${workspaceFolder}` variables
- ✅ Updated `scripts/mcp-server.cjs` wrapper - workspace isolation support
- ✅ Updated `.gitignore` - MCP workspace files exclusion

## Usage

```bash
# Auto-detect mode (recommended)
./scripts/setup-mcp-dev.sh

# Force Claude CLI mode
./scripts/setup-mcp-dev.sh --cli

# Force Claude Desktop mode
./scripts/setup-mcp-dev.sh --desktop

# Validate setup
./scripts/test-mcp-setup.sh

# Use with Claude CLI: run `claude`
# Use with Claude Desktop: open directory in Claude Desktop
```
