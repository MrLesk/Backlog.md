## Local Development

> **Runtime requirements:** Use Bun 1.4.3 and Node.js 26.12.1 or later, matching CI and the Nix development shell.

Run these commands to bootstrap the project:

```bash
bun install --cafile /path/to/incident-filtered-ca-bundle.pem
```

Bun 1.4.3 still contains the compromised eMudhra trust paths. Until a patched
Bun release is available, use an incident-filtered CA bundle explicitly for Bun
package-manager requests. Updating the OS or setting `SSL_CERT_FILE` alone does
not replace Bun's built-in trust. CI constructs this bundle offline before its
network steps and passes it to every Bun install. Do not use `bun x`/`bunx` to
download the Nix generator: Bun 1.4.3 can ignore its explicit CA file when
resolving packages under inherited/custom trust. The updater uses patched Node
and native npm for downloads instead. Hosted
runner trust during initial action preparation remains the runner vendor's
responsibility. Bun's bundled Brotli security fix is also pending upstream; the
package manager retains that runtime risk even with filtered certificate trust.
The shipped Backlog CLI does not use Bun for outbound HTTPS. Task reads and ID
allocation can fetch HTTPS remotes through native Git; Backlog gives those fetch
children filtered trust while preserving private CAs and authentication. Direct
HTTP/HTTPS and ordinary HTTP proxies remain supported. Git HTTPS proxies are
blocked for both HTTP and HTTPS origins, including proxies with valid private
certificates: Git cannot isolate their CA directory, so a filtered proxy CA file
alone still admits compromised host roots. Fetch children set
`GIT_PROXY_SSL_CAINFO` to an impossible path beneath an owned regular file to fail
before proxy HTTP or authentication is sent. An empty CA file is insufficient
because some libcurl versions fall back to their proxy CA directory.
Use a direct connection, an HTTP proxy, or disable `remoteOperations` for offline
use. SSH and local remotes use their normal Git behavior.

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

## Standalone Builds

`bun run build` produces a standalone executable with ESM bytecode. Bytecode
reduces parsing work at startup, at the cost of a larger executable. Release
builds use the same settings for every supported target.

For cross compilation, run `node scripts/prepare-bun-runtime.cjs <target>` with
patched Node first, then set `BACKLOG_BUILD_EXECUTABLE_PATH` to its printed
executable path. The helper verifies the official release SHA-256 before
extracting the target runtime. CI exports this path automatically, so Bun's
unpatched native target downloader is never used in release builds.

Set `BACKLOG_BUILD_OUTDIR` to emit JavaScript and browser assets instead. Nix
and integration tests use this bundle path without bytecode compilation.

## Nix Packaging

The flake uses bun2nix v2 to turn the repository's `bun.lock` into an offline
dependency cache. Regenerate `bun.nix` whenever `bun.lock` changes:

```bash
SSL_CERT_FILE=/path/to/incident-filtered-ca-bundle.pem bun run update-nix
```

The command requires patched Node 26.12.1 or later and a readable, nonempty
filtered CA bundle before resolving the generator. Inside `nix develop`, it uses
the local bun2nix only after verifying version 2.1.2. Otherwise it requires npm
12.2.0 or later and downloads the exact bun2nix 2.1.2 package through native npm
under that same Node, with explicit `--cafile` and `--strict-ssl=true`. npm retains
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

The package build also runs the installed CLI and browser smoke checks. Lock
generation does not require Docker and package installation does not rewrite
Nix files.

The flake is intentionally limited to `x86_64-linux`, `aarch64-linux`, and
`aarch64-darwin`, which are the systems supported by the current Nixpkgs Bun
package. On x86_64 Linux, the application runs with the official Bun 1.4.3
unified x64 runtime. It requires SSE4.2 and selects CPU-specific paths at
runtime. Dependency installation, the non-compile bundle build, the development
shell, and the installed application all use that runtime. Project format and
lint commands use the Biome version pinned in `bun.lock` rather than a second
Nix-provided version. The development shell's Node uses official 26.12.1
archives with published SHA-256 digests, preserving the release's bundled
security fixes, and npm 12.2.0 from its integrity-pinned registry archive; Linux binaries are adapted with header order preserved by `patchelf --no-sort`. The flake also
applies upstream Brotli commit `0ed4268a4401abcb4472096340477cf4af7d1a2b`
for CVE-2026-111497 to the shell's curl and Git, avoiding a full Nixpkgs rebuild.
The shell exports a current Node/NSS root bundle filtered for the incident as
`SSL_CERT_FILE`, an empty `SSL_CERT_DIR`,
and matching Git/curl/npm trust settings. Run `bun install --cafile "$SSL_CERT_FILE"`
inside `nix develop`; `bun run update-nix` uses the same bundle automatically.
The shell also selects an impossible `GIT_PROXY_SSL_CAINFO` path beneath an
owned regular file: native Git HTTPS proxies are unsupported for the same reason
as runtime fetches. Keep that
restriction when selecting private origin roots below; a real proxy CA file
would not isolate the host's proxy CA directory.

This is an explicit, reproducible public CA selection: it overrides the host's
Git and npm CA settings, including URL-specific Git settings. For private Git
servers or registries, select an incident-filtered bundle containing their
required private roots after entering the shell. Include the required public
roots too if those services are also needed:

```bash
ca_directory=$(mktemp -d)
node scripts/filter-trusted-cas.cjs /path/to/required-ca-bundle.pem "$ca_directory"
export SSL_CERT_FILE="$ca_directory/ca-bundle.crt"
export GIT_SSL_CAINFO="$SSL_CERT_FILE" NPM_CONFIG_CAFILE="$SSL_CERT_FILE"
export SSL_CERT_DIR="$ca_directory/empty" GIT_SSL_CAPATH="$ca_directory/empty"
```

Outside an explicitly overridden shell, Backlog's native HTTPS fetch protection
preserves the effective private Git CA policy automatically.

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
- The workflow pins Node.js 26.12.1 and npm 12.2.0 for trusted publishing.
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
