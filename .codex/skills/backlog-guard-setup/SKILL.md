---
name: backlog-guard-setup
description: Configure the backlog-guard PreToolUse hook for this project. Auto-detects
  the backlog directory, creates the .backlog-guard config file, writes the hook entry
  into .claude/settings.json or settings.local.json, and optionally adds mcp__backlog__*
  permissions to the allowlist.
---

# Backlog Guard Setup

Install the `backlog-guard` PreToolUse hook, which hard-blocks direct
`Read`/`Edit`/`Write`/`Bash` access to Backlog.md data directories and redirects
agents to the correct MCP tool or CLI command.

## Steps

### 1. Detect backlog directories

Search for `backlog/config.yml` starting from CWD, walking up to the git root.
Collect all matches — in a monorepo there may be more than one.

If no `backlog/config.yml` is found, ask the user:
> "I couldn't find a backlog directory automatically. Please provide the path(s)
> to the directory (or directories) that agents should not access directly."

### 2. Locate the hook script (`guard.sh`)

Check these locations in order:

1. `<git-root>/hooks/backlog-guard/guard.sh` — running from the Backlog.md source tree
2. `$(npm root -g 2>/dev/null)/backlog.md/hooks/backlog-guard/guard.sh` — global npm install
3. `$(~/.bun/bin/backlog --prefix 2>/dev/null)/hooks/backlog-guard/guard.sh` — bun global install

If none resolves, ask the user:
> "I couldn't locate guard.sh automatically. Please provide the absolute path to
> the guard.sh file from the backlog-guard hook."

### 3. Create `.backlog-guard` config file

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

### 4. Determine the settings target

Ask:
> "Should I add the hook to the project-local settings (`.claude/settings.local.json`)
> or your user-global settings (`~/.claude/settings.json`)?
> Project-local is recommended for backlog-specific repos."

Default: project-local.

### 5. Write the hook entry

Read the target settings file. If it does not exist, start with `{}`.

Merge the following into `hooks.PreToolUse` (append, do not replace existing entries):

```json
{
  "      "matcher": "Read|Edit|Write|Bash|Grep",",
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

### 6. Offer to add MCP tool permissions

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

### 7. Confirm and report

Show the user a summary of what was written:
- Path of `.backlog-guard` and its contents
- Target settings file and the hook entry added
- MCP permissions added (if any)

Remind the user:
> "Reload Claude Code (or open a new session) for the hook to take effect."

### Verification

To confirm the hook is active, ask Claude Code to:
```
Read backlog/tasks/<any-task-file>.md
```
The hook should deny the request and suggest `mcp__backlog__task_view` instead.
