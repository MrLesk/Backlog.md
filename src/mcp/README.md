# Backlog.md MCP Implementation (MVP)

This directory exposes a minimal stdio MCP surface so local agents can work with backlog.md without duplicating business
logic.

## What’s included

- `server.ts` / `createMcpServer()` – bootstraps a stdio-only server that extends `Core` and registers task-focused tools (`task_create`, `task_list`, `task_search`, `task_edit`, `task_view`, `task_archive`, `task_demote`).
- `tasks/` – consolidated task tooling that delegates to shared Core helpers (including plan/notes/AC editing).
- `tools/dependency-tools.ts` – dependency helpers reusing shared builders.
- `resources/` – lightweight resource adapters for agents.
- `guidelines/mcp/` – task workflow content surfaced via MCP.

Everything routes through existing Core APIs so the MCP layer stays a protocol wrapper.

## Development workflow

```bash
# Run the stdio server from the repo
bun run cli mcp start

# Or via the globally installed CLI
backlog mcp start

# Tests
bun test src/test/mcp-*.test.ts
```

The test suite keeps to the reduced surface area and focuses on happy-path coverage for tasks, dependencies, and server
bootstrap.
