# Backlog.md MCP Implementation (MVP)

This directory exposes a minimal stdio MCP surface so local agents can work with backlog.md without duplicating business
logic.

## What’s included

- `server.ts` / `createMcpServer()` – bootstraps a stdio-only server that extends `Core` and registers task, milestone, Definition of Done defaults, and document tools (`task_*`, `milestone_*`, `definition_of_done_defaults_*`, `document_*`) for MCP clients.
- `tasks/` – consolidated task tooling that delegates to shared Core helpers (including plan/notes/AC editing).
- `documents/` – document tooling layered on `Core`’s document helpers for list/view/create/update/archive/restore/delete/search flows, including docs-directory-relative path metadata.
- `tools/dependency-tools.ts` – dependency helpers reusing shared builders.
- `resources/` – lightweight resource adapters for agents.
- `guidelines/mcp/` – task workflow content surfaced via MCP.

Everything routes through existing Core APIs so the MCP layer stays a protocol wrapper.

Document tool `path` inputs are subdirectories under the configured docs directory, for example `guides/setup`.
Created and updated document responses include the persisted docs-relative file path. Absolute paths and traversal
segments such as `..` are rejected by the shared core/filesystem path handling.

`document_archive` calls `Core.archiveDocument`, the function behind `backlog doc archive`. The document's file moves
unchanged to the same relative path under `backlog/archive/docs/`, its ID stays reserved, and the document stays
viewable and becomes read-only. No task is changed: the result names the tasks and drafts whose documentation list names
the moved file.

`document_restore` and `document_delete` call `Core.restoreDocument` and `Core.deleteDocument`, the functions behind
`backlog doc restore` and `backlog doc delete`. Restore moves an archived document's file back, unchanged, to the same
relative path under `backlog/docs/`. Delete works only on an archived document, asks no question, removes its file and
releases its ID; the result names the tasks and drafts whose documentation list names the removed file.

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
