## Local Development

> **Runtime requirement:** Use Bun 1.2.23. Later Bun 1.3.x builds currently trigger a websocket CPU regression ([oven-sh/bun#23536](https://github.com/oven-sh/bun/issues/23536)), which also affects `backlog browser`. Our CI is pinned to 1.2.23 until the upstream fix lands.

Run these commands to bootstrap the project:

```bash
bun install
```

Run tests:

```bash
bun test
```

Format and lint:

```bash
npx biome check .
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
bun run mcp

# Optional: include debug logs
bun run mcp -- --debug
```

The server will start and listen on stdio. You should see log messages confirming the stdio transport is active.

#### 2. Configure Your Agent

Choose one of the methods below based on your agent:

**Claude Code (Recommended for Development):**
```bash
# Add to project (creates .mcp.json)
claude mcp add backlog-dev -- bun run mcp
```

**Codex CLI:**
```bash
# Edit ~/.codex/config.toml
[mcp_servers.backlog-dev]
command = "bun"
args = ["run", "mcp"]
```

**Gemini CLI:**
```bash
gemini mcp add backlog-dev bun run mcp
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

Each AI agent has different configuration requirements. Start the server from your project root and follow the assistant's instructions to register it:

```bash
backlog mcp start
```

### Testing with MCP Inspector

Use the Inspector tooling when you want to exercise the stdio server outside an AI agent.

#### GUI workflow (`npx @modelcontextprotocol/inspector`)

1. Launch the Inspector UI in a terminal: `npx @modelcontextprotocol/inspector`
2. Choose **STDIO** transport.
3. Fill the connection fields exactly as follows:
   - **Command**: `bun`
   - **Arguments** (enter each item separately): `--cwd`, `/Users/<you>/Projects/Backlog.md`, `src/cli.ts`, `mcp`, `start`
   - Remove any proxy token; it is not needed for local stdio.
4. Connect and use the tools/resources panes to issue MCP requests.

> Replace `/Users/<you>/Projects/Backlog.md` with the absolute path to your local Backlog.md checkout.

`bun run mcp` by itself prints Bun's `$ bun …` preamble, which breaks the Inspector’s JSON parser. If you prefer using the package script here, add `--silent` so the startup log disappears:

```
Command: bun
Arguments: run, --silent, mcp
```

> Remember to substitute your own project directory for `/Users/<you>/Projects/Backlog.md`.

#### CLI workflow (`npx @modelcontextprotocol/inspector-cli`)

Run the CLI helper when you want to script quick checks:

```bash
npx @modelcontextprotocol/inspector-cli \
  --cli \
  --transport stdio \
  --method tools/list \
  -- bun --cwd /Users/<you>/Projects/Backlog.md src/cli.ts mcp start
```

The key detail in both flows is to call `src/cli.ts mcp start` directly (or `bun run --silent mcp`) so stdout stays pure JSON for the MCP handshake.

### Adding New MCP Agents


### Project Structure

```
backlog.md/
├── src/
│   ├── mcp/
│   │   ├── errors/          # MCP error helpers
│   │   ├── resources/       # Read-only resource adapters
│   │   ├── tools/           # MCP tool implementations
│   │   ├── utils/           # Shared utilities
│   │   ├── validation/      # Input validators
│   │   └── server.ts        # createMcpServer entry point
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
