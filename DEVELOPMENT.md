## Local Development

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

## Release

To publish a new version to npm:

1. Update the `version` field in `package.json`.
2. Commit the change and create a git tag matching the version, e.g. `v0.1.0`.
   ```bash
   git tag v<version>
   git push origin v<version>
   ```
3. Push the tag to trigger the GitHub Actions workflow. It will build, test and
   publish the package to npm using the repository `NPM_TOKEN` secret.

[← Back to README](README.md)

