## Local Development

> **Runtime requirements:** Use Bun 1.4.4 and Node.js 26.12.1 or later, matching CI and the Nix development shell.

Run these commands to bootstrap the project:

```bash
bun install
```

Bun 1.4.4 includes the upstream Brotli decoder and compromised eMudhra
certificate fixes. Release executables embed that runtime; updating a separate
Bun installation does not patch an existing executable. CI still constructs
its own filtered certificate bundle for project-controlled downloads. The Nix
lock updater uses the pinned Node/npm build tools to download its generator.
Hosted runner trust during initial action preparation remains the runner
vendor's responsibility.

The shipped Backlog CLI delegates remote fetches to native Git. Git uses the
user's certificate, proxy and verification configuration. Backlog does not
replace the user's certificate store or impose its own HTTPS-proxy policy.
These environment settings remain the responsibility of the installed tools;
Backlog's build and release workflows manage their own download trust.

Run tests:

```bash
bun run test
```

Type-check with Bun's built-in checker:

```bash
bun run check:types
```

The script reads `tsconfig.json` and runs `bun --check`. Use that flag for a
direct check: `bun check` runs the repository's Biome script with the same name.
TypeScript stays installed for editor support.

Format and lint:

```bash
bun run check
```

For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

The pinned npm 12.2.1 build tool updates its bundled dependencies, but still
includes ip-address 10.7.2, affected by
[GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5),
and Undici 6.29.0, which predates the
[6.29.1 security fixes](https://github.com/nodejs/undici/releases/tag/v6.29.1).
These are remaining upstream build-tool advisories. npm is not bundled into
Backlog's native executable, and Backlog does not impose build-tool versions
on users' Node installations.

## Standalone Builds

`bun run build` produces a standalone executable with ESM bytecode. Bytecode
reduces parsing work at startup, at the cost of a larger executable. Release
builds use the same settings for every supported target.

For cross compilation, run `node scripts/prepare-bun-runtime.cjs <target>` with
patched Node first, then set `BACKLOG_BUILD_EXECUTABLE_PATH` to its printed
executable path. The helper verifies the official release SHA-256 before
extracting the target runtime. CI exports this path automatically, keeping
every target on the same verified Bun release.

Set `BACKLOG_BUILD_OUTDIR` to emit JavaScript and browser assets instead. Nix
and integration tests use this bundle path without bytecode compilation.

## Nix Packaging

The flake uses bun2nix v2 to turn the repository's `bun.lock` into an offline
dependency cache. It applies `package.json`'s `patchedDependencies` through
bun2nix's patch helper, using the same patch files as Bun installation.
Regenerate `bun.nix` whenever `bun.lock` changes:

```bash
SSL_CERT_FILE=/path/to/incident-filtered-ca-bundle.pem bun run update-nix
```

The command requires patched Node 26.12.1 or later and a readable, nonempty
filtered CA bundle before resolving the generator. Inside `nix develop`, it uses
the local bun2nix only after verifying version 2.1.2. Otherwise it requires npm
12.2.0 or later (CI and Nix pin 12.2.1) and downloads the exact bun2nix 2.1.2
package through native npm under that same Node, with explicit `--cafile` and `--strict-ssl=true`. npm retains
its normal authentication, registry and proxy configuration. The generator then
runs locally; it does not download packages through Bun. Commit the resulting
`bun.nix` change together with the lockfile change. bun2nix 2.1.2 requires
Bun lock format 1; update the existing lock instead of regenerating format 2.
Validate the package with:

```bash
nix build .#backlog-md
./result/bin/backlog --version
nix flake check
```

The package build also checks task creation, reading, listing, editing and failed-write exit status,
along with the installed browser and MCP smoke checks. Lock
generation does not require Docker and package installation does not rewrite
Nix files.

The flake is intentionally limited to `x86_64-linux`, `aarch64-linux`, and
`aarch64-darwin`, which are the systems supported by the current Nixpkgs Bun
package. On x86_64 Linux, the application runs with the official Bun 1.4.4
unified x64 runtime. It requires SSE4.2 and selects CPU-specific paths at
runtime. Dependency installation, the non-compile bundle build, the development
shell, and the installed application all use that runtime. Project format and
lint commands use the Biome version pinned in `bun.lock` rather than a second
Nix-provided version. The development shell's Node uses official 26.12.1
archives with published SHA-256 digests, preserving the release's bundled
security fixes, and npm 12.2.1 from its integrity-pinned registry archive; Linux binaries are adapted with header order preserved by `patchelf --no-sort`. The flake also
applies upstream Brotli commit `0ed4268a4401abcb4472096340477cf4af7d1a2b`
for CVE-2026-111497 to the shell's curl and Git, avoiding a full Nixpkgs rebuild.
The development shell pins tools without overriding the host's Git/npm
certificate or proxy settings. Build checks use their own filtered certificate
bundle. Commands that download dependencies use an explicit CA bundle as shown
above; entering the shell does not select that bundle for unrelated commands.

The Nix install check executes the packaged CLI natively and under QEMU's Ivy
Bridge CPU model. JSC's JIT is disabled only for the emulated check because it
is not reliable under QEMU user mode; normal packaged execution keeps JIT
enabled. A negative control verifies that the same emulated CPU rejects a
pinned AVX2-only Bun 1.3.13 archive before accepting the unified runtime.

## MCP Development Setup

This project supports MCP (Model Context Protocol) integration. To develop and test MCP features:

### Prerequisites

Install at least one AI coding assistant:
- [Claude Code](https://claude.ai/download)
- [OpenAI Codex CLI](https://openai.com/codex)
- [Google Gemini CLI](https://cloud.google.com/gemini/docs/codeassist/gemini-cli)
- [Kiro CLI](https://kiro.dev)

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

**Kiro CLI:**
```bash
kiro-cli mcp add --scope global --name backlog-dev --command bun --args run,mcp
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
- The workflow pins Node.js 26.12.1 and npm 12.2.1 for trusted publishing.
  Review both pins together when updating release tooling.

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
