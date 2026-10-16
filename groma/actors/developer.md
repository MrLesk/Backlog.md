---
type: C4 Actor
title: Developer
description: Plans, reviews and tracks work in the repository
status: stable
groma:
  id: developer
---

A person working in a Git repository or a plain folder. They capture intent as tasks with acceptance criteria, review specs and plans before an agent writes code, follow progress on the terminal board or in the browser, and keep finished tasks as a readable record. Everything works without an AI agent, an account or a server.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [developer](developer.md) | [commands](../systems/backlog-md/containers/backlog-cli/components/commands.md) | Runs backlog commands | Terminal |
| [developer](developer.md) | [terminal-board](../systems/backlog-md/containers/backlog-cli/components/terminal-board.md) | Moves tasks on the board | Terminal UI |
| [developer](developer.md) | [app-shell](../systems/backlog-md/containers/web-ui/components/app-shell.md) | Manages tasks in the browser | Web browser |
