---
type: C4 Actor
title: AI coding agent
description: Claude Code, Codex, Gemini CLI, Kiro and other assistants
status: stable
groma:
  id: ai-coding-agent
---

An AI assistant working on the developer's behalf. It reads the workflow guides first, then searches, creates and updates tasks, records its plan and notes, and checks acceptance criteria as it works. The CLI, with plain text and JSON output, is the canonical path; MCP over stdio is an optional adapter for clients that prefer it. Either way it changes the same Markdown tasks the developer reviews.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [ai-coding-agent](ai-coding-agent.md) | [commands](../systems/backlog-md/containers/backlog-cli/components/commands.md) | Runs backlog commands | Shell |
| [ai-coding-agent](ai-coding-agent.md) | [agent-instructions](../systems/backlog-md/containers/backlog-cli/components/agent-instructions.md) | Reads workflow guides | backlog instructions |
| [ai-coding-agent](ai-coding-agent.md) | [mcp-server](../systems/backlog-md/containers/backlog-cli/components/mcp-server.md) | Calls Backlog tools | MCP over stdio |
