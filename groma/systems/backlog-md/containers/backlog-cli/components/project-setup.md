---
type: C4 Component
title: Project setup
status: stable
groma:
  id: project-setup
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/init.ts
    - scanner: typescript
      file: src/commands/advanced-config-wizard.ts
    - scanner: typescript
      file: src/commands/configure-advanced-settings.ts
      symbol: configureAdvancedSettings
    - scanner: typescript
      file: src/utils/agent-selection.ts
    - scanner: typescript
      file: src/utils/mcp-client-setup.ts
  group: Command line
description: 'Creates and configures a project: backlog init and backlog config'
---

Runs `backlog init` and `backlog config`. Initialization creates the backlog folder and config, reserves ID prefixes, and connects AI tools: it writes agent instruction files or, when the developer picks MCP, registers the connector with Claude Code, Codex, Gemini CLI or Kiro. The browser setup screen runs the same initialization. The advanced config wizard covers cross-branch, Git, ID, editor and Web UI settings.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/core/init.ts](../../../../../../src/core/init.ts) | [src/agent-instructions.ts](../../../../../../src/agent-instructions.ts) | Writes agent instruction files | In-process call |
| [src/core/init.ts](../../../../../../src/core/init.ts) | [src/file-system/operations.ts](../../../../../../src/file-system/operations.ts) | Creates the backlog folder | In-process call |
