---
type: C4 Component
title: Agent instructions
status: stable
groma:
  id: agent-instructions
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/agent-instructions.ts
    - scanner: typescript
      file: src/mcp/workflow-guides.ts
    - scanner: typescript
      file: src/commands/instructions.ts
    - scanner: typescript
      file: src/guidelines/cli-instructions/index.ts
    - scanner: typescript
      file: src/guidelines/mcp/index.ts
    - scanner: typescript
      file: src/guidelines/index.ts
  group: Command line
description: Workflow guides that teach agents how to use Backlog.md
---

Holds the overview, task creation, task execution and task finalization guides that ship inside the executable. Agents read them with `backlog instructions <guide>`, or as backlog://workflow resources over MCP. During init it also writes a short nudge into AGENTS.md, CLAUDE.md, GEMINI.md, the Copilot instructions or the README that points agents to `backlog instructions overview`.
