## Local Development

### TL;DR

```bash
git clone <repository-url>
cd Backlog.md
bun install && bun link    # Sets up dev environment
bun test                    # Run tests
```

For detailed troubleshooting, see sections below.

---

### Quick Start

The project now features smart CLI detection for seamless development workflow:

```bash
git clone <repository-url>
cd Backlog.md
bun install       # Automatically sets up development environment
bun link          # Creates global symlink - now works seamlessly!
```

The CLI automatically detects your development environment and uses TypeScript source files directly, eliminating the need for manual builds during development.

### Development Commands

```bash
bun test          # Run all tests
bun test --watch  # Run tests in watch mode
bun run check .   # Format and lint with Biome
bunx tsc --noEmit # Type-check code
```

### CLI Detection Behavior

The smart CLI wrapper (`scripts/cli.cjs`) automatically chooses the best execution mode with improved priority:

- **Development Mode**: Uses `bun src/cli.ts` when:
  - Globally linked installation detected (`bun link` or `npm link`)
  - OR source files exist and no platform binaries available
  - Bun runtime is available

- **Production Mode**: Uses platform binaries when:
  - Installed via npm/npx with platform-specific packages
  - Platform binary packages are available

- **Built Mode**: Uses `dist/backlog` when:
  - Built binary exists but no source files (rare scenario)
  - Manual override with `BACKLOG_EXECUTION_MODE=built`

### Troubleshooting Development Issues

**❌ "Unknown command" error after `bun link`:**
```bash
# This usually means the built binary is corrupted or incompatible
# Solution 1: Force development mode
BACKLOG_EXECUTION_MODE=development backlog --version

# Solution 2: Rebuild the binary
bun run build

# Solution 3: Enable debug to see what's happening
BACKLOG_DEBUG=true backlog --version
```

**❌ "Bun runtime not found" error:**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
# Restart your terminal

# Or force using built binary instead
BACKLOG_EXECUTION_MODE=built backlog --version
```

**❌ CLI still using old version after `bun link`:**
```bash
# Enable debug mode to see detection logic
BACKLOG_DEBUG=true backlog --version

# Check if global link detection is working
# Should show "Is globally linked: true"

# Force development mode if needed
BACKLOG_EXECUTION_MODE=development backlog --version
```

**🔧 Manual Execution Mode Override:**
```bash
# Force development mode (uses bun src/cli.ts)
BACKLOG_EXECUTION_MODE=development backlog --version

# Force built mode (uses dist/backlog)
BACKLOG_EXECUTION_MODE=built backlog --version

# Force production mode (uses platform binary)
BACKLOG_EXECUTION_MODE=production backlog --version
```

**🔧 Disable Smart Detection (Legacy Mode):**
```bash
export BACKLOG_SMART_CLI=false
# CLI will fall back to legacy platform binary behavior
```

**🔍 Debug Information:**
```bash
# See detailed execution mode detection
BACKLOG_DEBUG=true backlog --version

# Check what the CLI wrapper detects:
# - Script real path (follows symlinks)
# - Project root directory
# - Available execution options (src, dist, platform binary)
# - Global link status
# - Final execution mode choice
```

### MCP Development Troubleshooting

**❌ MCP setup creates .mcp.json with wrong paths:**
```bash
# This happens when running `backlog mcp setup` from a different project
# The fix automatically detects cross-project setup

# Solution 1: The new setup detects this and creates correct paths
backlog mcp setup --force

# Solution 2: Manually verify the generated .mcp.json
cat .mcp.json
# Should contain: "command": "backlog" (not absolute paths)
```

**❌ MCP server fails to start in development mode:**
```bash
# Check what type of setup was created
backlog mcp doctor

# Force development template if needed
backlog mcp setup --force

# Test MCP connection
backlog mcp test --verbose
```

**🔧 MCP Cross-Project Development:**
```bash
# When developing backlog.md but using MCP in another project:
cd /path/to/other/project
backlog mcp setup    # Automatically detects cross-project scenario

# The setup will:
# - Use templates from backlog.md source directory
# - Configure command to use global 'backlog' (your dev version)
# - Set correct project root for the target project
```

For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## MCP Development Setup

This project supports MCP (Model Context Protocol) integration. To develop and test MCP features:

### Prerequisites

Install at least one AI coding assistant:
- [Claude Code](https://claude.ai/download)
- [OpenAI Codex CLI](https://openai.com/codex)
- [Google Gemini CLI](https://cloud.google.com/gemini/docs/codeassist/gemini-cli)

### Local MCP Testing

#### 1. Start MCP Server in Development Mode

```bash
# Terminal 1: Start the MCP server
bun run src/mcp-stdio-server.ts
```

The server will start and listen on stdio. You should see:
```
MCP Server started (stdio mode)
Server name: backlog-md
Available tools: 40+
```

#### 2. Configure Your Agent

Choose one of the methods below based on your agent:

**Claude Code (Recommended for Development):**
```bash
# Add to project (creates .mcp.json)
claude mcp add backlog-dev -- bun run $(pwd)/src/mcp-stdio-server.ts
```

**Codex CLI:**
```bash
# Edit ~/.codex/config.toml
[mcp_servers.backlog-dev]
command = "bun"
args = ["run", "/absolute/path/to/backlog.md/src/mcp-stdio-server.ts"]
```

**Gemini CLI:**
```bash
gemini mcp add backlog-dev bun run $(pwd)/src/mcp-stdio-server.ts
```

#### 3. Test the Connection

Open your agent and test:
- "Show me all tasks in this project"
- "Create a test task called 'Test MCP Integration'"
- "Display the current board"

#### 4. Development Workflow

1. Make changes to MCP tools in `src/mcp/tools/`
2. Restart the MCP server (Ctrl+C, then re-run)
3. Restart your AI agent
4. Test your changes

### Testing Individual Agents

Each AI agent has different configuration requirements. Run `backlog mcp setup` to see agent-specific instructions.

### Adding New MCP Agents

To add support for a new AI assistant, create a JSON configuration file in `src/mcp/agents/` following the pattern of existing agents (claude-code.json, codex.json, etc.).

### Project Structure

```
backlog.md/
├── src/
│   ├── mcp/
│   │   ├── agents/          # Agent JSON configs
│   │   │   ├── claude-code.json
│   │   │   ├── codex.json
│   │   │   ├── gemini.json
│   │   │   └── loader.ts    # Agent config loader
│   │   ├── tools/           # MCP tool implementations
│   │   ├── prompts/         # MCP prompts
│   │   └── mcp-stdio-server.ts
│   └── commands/
│       └── mcp-setup.ts     # Setup command
└── docs/
    ├── mcp/                 # User-facing MCP docs
    └── development/         # Developer docs
```

## Release

Backlog.md now relies on npm Trusted Publishing with GitHub Actions OIDC. The
release workflow builds binaries, publishes all npm packages, and records
provenance automatically. Follow the steps below to keep the setup healthy.

### Prerequisites

- Choose the release version and ensure your git tag follows the
  `v<major.minor.patch>` pattern. The workflow automatically rewrites
  `package.json` files to match the tag, so you do **not** need to edit the
  version field manually.
- In npm's **Trusted publishers** settings, link the
  `MrLesk/Backlog.md` repository and the `Release multi-platform executables`
  workflow for each package: `backlog.md`,
  `backlog.md-linux-{x64,arm64}`, `backlog.md-darwin-{x64,arm64}`, and
  `backlog.md-windows-x64`.
- Remove the legacy `NODE_AUTH_TOKEN` repository secret. Publishing now uses
  the GitHub-issued OIDC token, so no long-lived npm tokens should remain.
- The workflow activates `npm@latest` (currently 11.6.0 as of 2025-09-18) via
  Corepack to satisfy npm's trusted publishing requirement of version 11.5.1 or
  newer. If npm raises the minimum version again, the latest tag will pick it
  up automatically.

### Publishing steps

1. Commit the version bump and create a matching tag. You can either push the
   tag from your terminal
   ```bash
   git tag v<major.minor.patch>
   git push origin main v<major.minor.patch>
   ```
   or create a GitHub Release in the UI (which creates the tag automatically).
   Both paths trigger the same `Release multi-platform executables` workflow.
2. Monitor the workflow run:
   - `Dry run trusted publish` and `Dry run platform publish` confirm that
     npm accepts the trusted publisher token before any real publish.
   - Publishing uses trusted publishing (no tokens) so npm automatically records
     provenance; no additional CLI flags are required.
3. After the workflow completes, verify provenance on npm by opening each
   package's **Provenance** tab or by running `npm view <package> --json | jq '.dist.provenance'`.

[← Back to README](README.md)
