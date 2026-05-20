---
name: backlog-guard-setup
description: Configure the backlog-guard hook for this project in Claude Code and/or
  OpenCode. Auto-detects the backlog directory, creates the .backlog-guard config file,
  writes the Claude Code hook entry into settings.json, and sets up the OpenCode plugin.
  Optionally adds mcp__backlog__* permissions to the allowlist.
---

# Backlog Guard Setup

Install `backlog-guard`, which hard-blocks direct `Read`/`Edit`/`Write`/`Bash` access
to Backlog.md data directories and redirects agents to the correct MCP tool or CLI
command.

Supports both **Claude Code** (PreToolUse hook via `guard.sh`) and **OpenCode**
(plugin via `opencode-plugin.js`). Run this skill once; it handles both if both are
in use.

## Steps

### 1. Detect backlog directories

Search for `backlog/config.yml` starting from CWD, walking up to the git root.
Collect all matches — in a monorepo there may be more than one.

If no `backlog/config.yml` is found, ask the user:
> "I couldn't find a backlog directory automatically. Please provide the path(s)
> to the directory (or directories) that agents should not access directly."

### 2. Locate the hook files

Check these locations in order for both `guard.sh` and `opencode-plugin.ts` (or its compiled `.js`):

1. `<git-root>/hooks/backlog-guard/` — running from the Backlog.md source tree
2. `$(npm root -g 2>/dev/null)/backlog.md/hooks/backlog-guard/` — global npm install
3. `~/.bun/lib/node_modules/backlog.md/hooks/backlog-guard/` — bun global install

If neither resolves, ask the user:
> "I couldn't locate the backlog-guard hook files automatically. Please provide the
> absolute path to the `hooks/backlog-guard/` directory."

### 3. Run install script (recommended)

If `hooks/backlog-guard/install.sh` exists, run it:

```bash
./hooks/backlog-guard/install.sh
```

It handles all remaining steps interactively. Skip to Step 8 for verification.

### 3b. Manual: Create `.backlog-guard` config file

Write `.backlog-guard` in the git root with the detected directories:

```yaml
# Directories that agents must not access directly.
# Paths are relative to this file (the git root).
dirs:
  - backlog/
```

Use the relative path from the git root for each directory.

If the file already exists, read it first and merge new directories rather than
overwriting. Confirm any changes with the user before writing.

### 4. Claude Code — determine settings target

Ask:
> "Should I add the Claude Code hook to the project-local settings
> (`.claude/settings.local.json`) or your user-global settings
> (`~/.claude/settings.json`)?
> Project-local is recommended for backlog-specific repos; global applies to all
> your projects."

Default: project-local.

### 5. Claude Code — write the hook entry

Read the target settings file. If it does not exist, start with `{}`.

Merge the following into `hooks.PreToolUse` (append, do not replace existing entries):

```json
{
  "matcher": "Read|Edit|Write|Bash|Grep",
  "hooks": [
    {
      "type": "command",
      "command": "<absolute-path-to-guard.sh>",
      "timeout": 10,
      "statusMessage": "Backlog Guard: checking access..."
    }
  ]
}
```

Where `<absolute-path-to-guard.sh>` is the resolved path from Step 2.

The hook discovers `.backlog-guard` automatically at runtime via `git rev-parse
--show-toplevel`, so no path or environment variable needs to be embedded in the
command string.

### 6. Claude Code — offer to add MCP tool permissions

Ask:
> "Should I also add `mcp__backlog__*` tool permissions to the settings allowlist?
> This lets agents use the MCP tools without being prompted for each call."

If yes, merge the following into `permissions.allow` in the same settings file:

```json
[
  "mcp__backlog__task_view",
  "mcp__backlog__task_list",
  "mcp__backlog__task_create",
  "mcp__backlog__task_edit",
  "mcp__backlog__task_search",
  "mcp__backlog__task_archive",
  "mcp__backlog__task_complete",
  "mcp__backlog__document_view",
  "mcp__backlog__document_list",
  "mcp__backlog__document_create",
  "mcp__backlog__document_update",
  "mcp__backlog__document_search",
  "mcp__backlog__milestone_list",
  "mcp__backlog__milestone_add",
  "mcp__backlog__milestone_rename",
  "mcp__backlog__milestone_remove",
  "mcp__backlog__milestone_archive",
  "mcp__backlog__get_backlog_instructions",
  "mcp__backlog__definition_of_done_defaults_get",
  "mcp__backlog__definition_of_done_defaults_upsert"
]
```

Deduplicate against any existing entries before writing.

### 7. OpenCode — compile + install the plugin

The OpenCode plugin is written in TypeScript (`opencode-plugin.ts`). It must be
compiled to JS before OpenCode can load it.

**Build the plugin:**

```bash
# From the Backlog.md source tree:
bun build hooks/backlog-guard/opencode-plugin.ts \
  --outfile hooks/backlog-guard/opencode-plugin.js \
  --target=node --format=esm

# From an npm global install, the compiled .js is already shipped:
# $(npm root -g)/backlog.md/hooks/backlog-guard/opencode-plugin.js
```

Then ask:
> "Are you also using OpenCode in this project? If yes, should I install the
> backlog-guard plugin globally (for all projects) or per-project only?"

**Global install** — symlink into OpenCode's global plugins directory:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf <absolute-path-to-opencode-plugin.js> ~/.config/opencode/plugins/backlog-guard.js
```

OpenCode auto-loads all `.js` files in `~/.config/opencode/plugins/` — no config
file changes needed.

**Per-project install** — add to `opencode.json` in the project root:

Read `opencode.json` (or start with `{"$schema":"https://opencode.ai/config.json"}`
if missing). Merge the plugin path into the `plugin` array:

```json
{
  "plugin": ["<absolute-or-relative-path-to-opencode-plugin.js>"]
}
```

Use a relative path (e.g. `./hooks/backlog-guard/opencode-plugin.js`) when running
from the Backlog.md source tree; use an absolute path otherwise.

The plugin discovers `.backlog-guard` automatically at runtime — no additional config
is needed in `opencode.json`.

### 8. Confirm and report

Show the user a summary of what was written:
- Path of `.backlog-guard` and its contents
- Claude Code: target settings file and the hook entry added; MCP permissions added (if any)
- OpenCode: plugin path symlinked or added to `opencode.json` (if applicable)

Remind the user:
> "Reload Claude Code and/or OpenCode (or open a new session) for the changes to
> take effect."

### Verification

**Claude Code** — ask Claude to:
```
Read backlog/tasks/<any-task-file>.md
```
The hook should deny the request and suggest `mcp__backlog__task_view` instead.

**OpenCode** — attempt a read on a backlog file. The plugin should block it and
display the task ID and MCP tool suggestion.
