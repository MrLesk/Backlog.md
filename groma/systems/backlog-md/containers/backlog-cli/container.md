---
type: C4 Container
title: Backlog CLI
status: stable
groma:
  id: backlog-cli
  parent: backlog-md
  technology: Bun, TypeScript, compiled to one binary
description: 'The backlog executable: commands, terminal UI, local web server and MCP server'
---

One executable, installed with npm, Bun, Homebrew or Nix, that runs in several modes. Plain commands such as `backlog task create` run and exit; `backlog board` and the interactive task views open a terminal UI; `backlog browser` starts a local HTTP and WebSocket server on 127.0.0.1 that serves the bundled web UI; `backlog mcp start` speaks MCP over stdio for AI clients. Every mode creates a Core for the project folder, so all of them share the same validation, identity rules and Markdown format.
