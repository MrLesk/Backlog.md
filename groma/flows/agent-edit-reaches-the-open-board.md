---
type: Groma Flow
title: Agent edit reaches the open board
groma:
  id: agent-edit-reaches-the-open-board
---

An agent edits a task from the command line while a developer has `backlog browser` open. The CLI process writes the Markdown file and exits; the separate web server process notices the change through its file watchers, tells the browser over WebSocket, and the browser refetches and updates the board in place. The two processes never talk to each other directly: the backlog folder is the hand-off.

## Steps

| From | To | Action |
| --- | --- | --- |
| [AI coding agent](../actors/ai-coding-agent.md) | [Commands](../systems/backlog-md/containers/backlog-cli/components/commands.md) | Runs backlog task edit |
| [Commands](../systems/backlog-md/containers/backlog-cli/components/commands.md) | [Core](../systems/backlog-md/containers/backlog-cli/components/core.md) | Applies the edit |
| [Core](../systems/backlog-md/containers/backlog-cli/components/core.md) | [File storage](../systems/backlog-md/containers/backlog-cli/components/file-storage.md) | Saves the task |
| [File storage](../systems/backlog-md/containers/backlog-cli/components/file-storage.md) | [backlog/ folder](../externals/backlog-folder.md) | Rewrites the Markdown file |
| [Content store](../systems/backlog-md/containers/backlog-cli/components/content-store.md) | [backlog/ folder](../externals/backlog-folder.md) | Notices the change in the web server process |
| [Content store](../systems/backlog-md/containers/backlog-cli/components/content-store.md) | [Web server](../systems/backlog-md/containers/backlog-cli/components/web-server.md) | Reports the changed task |
| [Web server](../systems/backlog-md/containers/backlog-cli/components/web-server.md) | [App shell](../systems/backlog-md/containers/web-ui/components/app-shell.md) | Pushes tasks-updated |
| [App shell](../systems/backlog-md/containers/web-ui/components/app-shell.md) | [API client](../systems/backlog-md/containers/web-ui/components/api-client.md) | Refetches tasks |
| [API client](../systems/backlog-md/containers/web-ui/components/api-client.md) | [Web server](../systems/backlog-md/containers/backlog-cli/components/web-server.md) | Requests the fresh list |
