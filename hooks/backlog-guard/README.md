# backlog-guard

A Claude Code `PreToolUse` hook that hard-blocks direct file operations on
Backlog.md data directories and redirects the agent to the correct MCP tool or
CLI command, with the exact replacement call pre-filled (task ID, document name,
or path already substituted from the blocked attempt).

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
| `Bash(cat backlog/tasks/...)` | `mcp__backlog__task_view(id="BACK-NNN")` | Same |
| `Bash(grep pattern backlog/)` | `mcp__backlog__task_search(query="...")` | Structured results |
| `Bash(find backlog/ -name "*.md")` | `mcp__backlog__task_list()` | Returns full task objects |

The hook fires before the tool executes, returns `{"permissionDecision": "deny"}`,
and injects a stop message naming the exact MCP tool or CLI command to use, with
the task ID or document name already extracted from the intercepted path.

## Files

```
guard.sh         Bash wrapper — reads stdin JSON, exports env vars, calls check.py
check.py         Python enforcement logic (blocking decision + directed stop message)
test_check.py    Pytest tests for all block/allow/edge cases
README.md        This file
```

## Installation

### Quick setup (recommended)

Run the setup skill in Claude Code:

```
/backlog-guard-setup
```

The skill auto-detects your backlog directory, creates the `.backlog-guard` config
file, writes the hook entry into your settings file, and optionally adds
`mcp__backlog__*` tool permissions to the allowlist.

### Manual setup

1. Locate the `guard.sh` path (e.g. `/path/to/Backlog.md/hooks/backlog-guard/guard.sh`)

2. Create `.backlog-guard` in your project root (see Configuration below)

3. Register the hook in `~/.claude/settings.json` (user-global) or
   `.claude/settings.local.json` (project-local):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/Backlog.md/hooks/backlog-guard/guard.sh",
            "timeout": 10,
            "statusMessage": "Backlog Guard: checking access..."
          }
        ]
      }
    ]
  }
}
```

`guard.sh` derives the path to `check.py` from its own `$DIR`, so the absolute
path to `guard.sh` is the only thing you need to set.

## Configuration

backlog-guard reads its protected directory list from a `.backlog-guard` YAML file.

### Discovery order

1. `git rev-parse --show-toplevel` → look for `.backlog-guard` at the git root
2. Walk CWD upward (up to 4 levels) looking for `.backlog-guard`
3. **Auto-detect fallback**: walk CWD upward looking for `backlog/config.yml`
   (protects the `backlog/` directory next to it)
4. Nothing found → hook exits cleanly with no output (safe in non-backlog repos)

### `.backlog-guard` format

```yaml
# Directories that agents must not access directly.
# Paths are relative to this file (the git root).
dirs:
  - backlog/
```

Multiple protected roots (e.g. a monorepo with separate backlogs):

```yaml
dirs:
  - backlog/
  - team-backlog/
```

The `.backlog-guard` file is useful to commit — it documents the access policy
for all contributors and agents working in the repository.

## What gets blocked

**Always blocked:**
- `Read`, `Edit`, `Write` on any file inside a configured protected directory

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

## Running tests

```bash
python -m pytest hooks/backlog-guard/test_check.py -v
```

Requires Python 3.11+ and `pyyaml` (`pip install pyyaml`).
`pytest` is also required (`pip install pytest`).

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
