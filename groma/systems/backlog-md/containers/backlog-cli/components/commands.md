---
type: C4 Component
title: Commands
status: stable
groma:
  id: commands
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/cli.ts
    - scanner: typescript
      file: src/commands/help-schema.ts
    - scanner: typescript
      file: src/utils/list-window.ts
    - scanner: typescript
      file: src/utils/read-output-mode.ts
    - scanner: typescript
      file: src/ui/root-entry.ts
    - scanner: typescript
      file: src/commands/task-wizard.ts
    - scanner: typescript
      file: src/commands/completion.ts
    - scanner: typescript
      file: src/completions/helper.ts
    - scanner: typescript
      file: src/completions/command-structure.ts
    - scanner: typescript
      file: src/completions/data-providers.ts
  group: Command line
  technology: Commander, @clack/prompts
description: Parses backlog commands and runs them against the core
---

Entry point of the executable (src/cli.ts). Defines the task, draft, doc, decision, milestone, board, search, config, doctor, cleanup, browser, overview and instructions commands, validates flags, and calls the core. It also owns structured help, list paging (--max-count, --skip, --count), the interactive create and edit wizards, the landing screen shown by a bare `backlog`, and shell completion for bash, zsh, fish and PowerShell.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Runs task operations | In-process call |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/server/index.ts](../../../../../../src/server/index.ts) | Starts the web server | backlog browser |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/commands/mcp.ts](../../../../../../src/commands/mcp.ts) | Starts the MCP server | backlog mcp start |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/ui/unified-view.ts](../../../../../../src/ui/unified-view.ts) | Opens the terminal UI | In-process call |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/formatters/json-output.ts](../../../../../../src/formatters/json-output.ts) | Prints versioned JSON | In-process call |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/formatters/task-plain-text.ts](../../../../../../src/formatters/task-plain-text.ts) | Prints plain task text | In-process call |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/core/init.ts](../../../../../../src/core/init.ts) | Initializes projects | backlog init |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/core/task-detail.ts](../../../../../../src/core/task-detail.ts) | Builds task details | In-process call |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/core/search-service.ts](../../../../../../src/core/search-service.ts) | Searches tasks and docs | backlog search |
| [src/cli.ts](../../../../../../src/cli.ts) | [src/commands/overview.ts](../../../../../../src/commands/overview.ts) | Shows project statistics | backlog overview |
