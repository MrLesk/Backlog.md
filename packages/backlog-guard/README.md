# @lenucksi/backlog-guard

OpenCode plugin that blocks direct file access to Backlog.md data directories
and redirects to the correct MCP tool or CLI command.

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["@lenucksi/backlog-guard"]
}
```

## What it does

- **Read/Edit/Write** on files under `backlog/` → blocked, suggests `mcp__backlog__task_view` / `backlog_task_view`
- **Grep** on `backlog/tasks/` or `backlog/docs/` → blocked, suggests `mcp__backlog__task_search` / `backlog_task_search`
- **Bash cat/grep/find** on backlog directories → blocked, suggests CLI equivalents

## Config

Create `.backlog-guard` at your project root:

```yaml
dirs:
  - backlog/
```

## Skills

This plugin ships with Backlog.md skills that teach agents proper backlog workflows:
- `use-backlog-mcp` — MCP/CLI equivalents for all backlog operations
- `create-backlog-task` — task creation with correct structure

## License

MIT
