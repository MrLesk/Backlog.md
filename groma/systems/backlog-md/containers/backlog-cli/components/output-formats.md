---
type: C4 Component
title: Output formats
status: stable
groma:
  id: output-formats
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/formatters/json-output.ts
    - scanner: typescript
      file: src/formatters/task-plain-text.ts
    - scanner: typescript
      file: src/formatters/dependency-graph-text.ts
    - scanner: typescript
      file: src/commands/watch-json.ts
    - scanner: typescript
      file: src/utils/utc-date-display.ts
  group: Command line
description: Plain text and versioned JSON output for people, scripts and agents
---

Turns tasks, search results and dependency graphs into the --plain text and versioned --json shapes that scripts and agents rely on, including `task list --json --watch`, which emits a complete replacement list whenever tasks change. The plain task view is shared with the MCP tools. It also formats stored UTC timestamps for display.
