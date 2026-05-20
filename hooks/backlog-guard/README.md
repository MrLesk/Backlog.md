# backlog-guard

A `PreToolUse` hook (Claude Code) and `tool.execute.before` plugin (OpenCode) that
hard-blocks direct file operations on Backlog.md data directories and redirects the
agent to the correct MCP tool or CLI command, with the exact replacement call
pre-filled (task ID, document name, or path already substituted from the blocked
attempt).

## Why

Agents default to `Read`/`Edit`/`Write`/`Bash cat` on backlog markdown files even
when MCP tools and the backlog CLI are available. Direct file access is strictly
inferior and explicitly forbidden:

| Blocked call | Correct replacement | Why it's better |
|---|---|---|
| `Read(backlog/tasks/back-123-....md)` | `mcp__backlog__task_view(id="BACK-123")` | Parses metadata, respects locks |
| `Edit(backlog/tasks/back-123-....md)` | `mcp__backlog__task_edit(id="BACK-123", ...)` | Validates fields, triggers git hooks |
| `Write(backlog/tasks/...)` | `mcp__backlog__task_create(title=...)` | Allocates ID, sets ordinal |
| `Read(backlog/docs/arch.md)` | `mcp__backlog__document_view(path="arch.md")` | Returns structured metadata |
| `Grep(pattern, backlog/tasks/)` | `mcp__backlog__task_search(query="...")` | Structured task results |
| `Grep(pattern, backlog/docs/)` | `mcp__backlog__document_search(query="...")` | Structured doc results |
| `Bash(cat backlog/tasks/...)` | `mcp__backlog__task_view(id="BACK-NNN")` | Same |
| `Bash(grep pattern backlog/)` | `mcp__backlog__task_search(query="...")` | Structured results |
| `Bash(find backlog/ -name "*.md")` | `mcp__backlog__task_list()` | Returns full task objects |

The hook fires before the tool executes and hard-blocks it, injecting a stop message
naming the exact MCP tool or CLI command to use, with the task ID or document name
already extracted from the intercepted path.

## Files

```
guard-core.ts        Shared core logic: config discovery, path checking, bash analysis, suggestions
guard-core.test.ts   Tests via `bun test`
claude-hook.ts       Claude Code entry — reads env vars, calls guard-core, prints JSON deny
opencode-plugin.ts   OpenCode entry — exports `tool.execute.before` handler, calls guard-core
guard.sh             Bash wrapper — reads stdin JSON, calls claude-hook.ts via bun/npx/node
README.md            This file
```

All three targets (Claude Code, OpenCode) share `guard-core.ts`. The Python (`check.py`)
and standalone JS plugin (`opencode-plugin.js`) were removed in the TypeScript refactor.

---

## Installation

### Quick setup (recommended — Claude Code only)

Run the setup skill in Claude Code:

```
/backlog-guard-setup
```

The skill auto-detects your backlog directory, creates the `.backlog-guard` config
file, writes the hook entry into your settings file, and optionally adds
`mcp__backlog__*` tool permissions to the allowlist.

### Manual setup

#### Step 1 — Create `.backlog-guard` in your project git root

```yaml
# .backlog-guard
# Directories that agents must not access directly.
# Paths are relative to this file (the git root).
dirs:
  - backlog/
```

Multiple roots (monorepo):

```yaml
dirs:
  - backlog/
  - team-backlog/
```

This file is worth committing — it documents the access policy for all contributors.

#### Step 2 — Locate the hook files

Find the path to `guard.sh` (Claude Code) or `opencode-plugin.js` (OpenCode):

| Install method | Path |
|---|---|
| Source tree | `<repo-root>/hooks/backlog-guard/` |
| npm global install | `$(npm root -g)/backlog.md/hooks/backlog-guard/` |
| bun global install | `~/.bun/lib/node_modules/backlog.md/hooks/backlog-guard/` |

#### Step 3 — Register the hook

**Claude Code — global** (`~/.claude/settings.json`, applies to all projects):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|Bash|Grep",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/hooks/backlog-guard/guard.sh",
            "timeout": 10,
            "statusMessage": "Backlog Guard: checking access..."
          }
        ]
      }
    ]
  }
}
```

`guard.sh` derives the path to `claude-hook.ts` from its own `$DIR`, so the absolute
path to `guard.sh` is the only thing you need to set. It prefers `bun run` when
available, falls back to `npx tsx`, then `node claude-hook.js`.

**Claude Code — per project** (`.claude/settings.json` or `.claude/settings.local.json`):

Same JSON structure as above, placed in the project-level settings file. Project
settings override global settings for that project.

**OpenCode — global** (`~/.config/opencode/plugins/backlog-guard.js`):

Compile the plugin first (requires Bun):

```bash
bun build hooks/backlog-guard/opencode-plugin.ts \
  --outfile hooks/backlog-guard/opencode-plugin.js \
  --target=node --format=esm
```

Then symlink or copy:

```bash
ln -s /absolute/path/to/hooks/backlog-guard/opencode-plugin.js \
      ~/.config/opencode/plugins/backlog-guard.js
```

Or use the pre-built `opencode-plugin.js` shipped with the npm package.

OpenCode auto-loads all `.js` files from `~/.config/opencode/plugins/` — no config
file changes needed.

**OpenCode — per project** (`opencode.json`):

```json
{
  "plugin": ["./hooks/backlog-guard/opencode-plugin.js"]
}
```

For projects that use backlog.md from npm global install, the path resolves via
`node_modules` lookup, or you can provide an absolute path.

---

## How it works per tool

### Claude Code

`guard.sh` is called as a `PreToolUse` hook. It reads the JSON payload from stdin,
extracts `tool_name`, `tool_input.file_path`, and `tool_input.command` into env vars,
then runs `claude-hook.ts` (via `bun run`, `npx tsx`, or `node`). If blocked,
`claude-hook.ts` prints a JSON deny response and exits.

### OpenCode

`opencode-plugin.ts` exports a `tool.execute.before` handler (compiled to
`opencode-plugin.js`). OpenCode calls it before each tool execution with
`{ tool, args }`. If the call targets a protected directory, the handler throws an
`Error` — OpenCode treats a thrown error as a hard block and shows the error
message to the model.

Both use the same shared core (`guard-core.ts`) and the same `.backlog-guard`
config file.

---

## What gets blocked

**Always blocked:**
- `Read`, `Edit`, `Write` on any file inside a configured protected directory
- `Grep` tool where the `path` parameter resolves inside a configured protected directory

**Blocked in the first pipeline segment only** (everything after `|` reads stdin
and is never blocked):
- `Bash` with `cat`, `head`, `tail`, `less`, `more`, `bat` targeting a protected path
- `Bash` with `grep`/`egrep`/`fgrep PATTERN file` where the file arg is protected
  (the pattern position is excluded, so `grep "backlog" logfile.txt` is not blocked)
- `Bash` with `find <protected-dir> ...` — blocked if the search root is protected

**Never blocked:**
- Files outside the configured protected directories
- `cmd | grep backlog` — pipeline stdin filtering
- `ls backlog/` — directory listing (not a content read)
- `git status`, `git log`, `git diff` — git operations on backlog files are fine
- Projects with no `.backlog-guard` and no `backlog/config.yml`

---

## Configuration

### Discovery order

Both `claude-hook.ts` and `opencode-plugin.ts` use the same discovery order (in `guard-core.ts`):

1. `git rev-parse --show-toplevel` → look for `.backlog-guard` at the git root
2. Walk CWD upward (up to 4 levels) looking for `.backlog-guard`
3. **Auto-detect fallback**: walk CWD upward looking for `backlog/config.yml`
   (protects the `backlog/` directory next to it)
4. Nothing found → hook exits cleanly with no output (safe in non-backlog repos)

### `.backlog-guard` format

```yaml
# Paths are relative to this file (the git root).
dirs:
  - backlog/
```

---

## Development

```bash
# Run tests + build (one command)
./hooks/backlog-guard/dev.sh

# Or individual steps:
./hooks/backlog-guard/dev.sh test    # run tests
./hooks/backlog-guard/dev.sh build   # compile JS bundles
./hooks/backlog-guard/dev.sh check   # Biome + TypeScript check

# Via npm scripts:
bun run guard:test    # bun test hooks/backlog-guard/guard-core.test.ts
bun run guard:build   # compile TS → JS bundles
bun run guard:dev     # test + build
```

## Installation

### Automated install

Run the interactive install script from the target project root:

```bash
./hooks/backlog-guard/install.sh
```

It will:
1. Create/verify `.backlog-guard` config
2. Install the Claude Code hook (project-local or global)
3. Optionally add MCP permissions to Claude Code settings
4. Install the OpenCode plugin (global symlink or per-project `opencode.json`)

### Manual setup

See the steps below for manual installation.

---

#### Step 1 — Create `.backlog-guard` in your project git root

---

## Comparison

| | Claude Code | OpenCode |
|---|---|---|
| Hook mechanism | Shell command in `settings.json` `hooks.PreToolUse` | JS plugin `tool.execute.before` |
| Block method | JSON `{"permissionDecision": "deny"}` to stdout | `throw new Error(...)` |
| Config file | `.backlog-guard` YAML (shared) | `.backlog-guard` YAML (shared) |
| Global install | Entry in `~/.claude/settings.json` | Symlink/copy to `~/.config/opencode/plugins/` |
| Per-project install | Entry in `.claude/settings.json` | `"plugin"` array in `opencode.json` |
| Shared logic | `guard-core.ts` | `guard-core.ts` (compiled to JS) |
| Runtime | Bun / npx / Node.js | OpenCode (Node.js) |

## Relationship to serena-guard

backlog-guard is a sibling to
[serena-guard](https://github.com/Lenucksi/serena-guard), which protects source
code files from direct access and redirects to Serena/LSP tools.

| | serena-guard | backlog-guard |
|---|---|---|
| Detects violations by | File extension (`.ts`, `.py`, etc.) | Directory prefix (`backlog/`) |
| Config | `extensions.yaml` in hook dir | `.backlog-guard` at git root |
| Alternatives suggested | Serena MCP + LSP | Backlog MCP + CLI |
| Block strength | Hard (every call, no exceptions) | Hard (every call, no exceptions) |
