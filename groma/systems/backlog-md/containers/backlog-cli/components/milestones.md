---
type: C4 Component
title: Milestones
status: stable
groma:
  id: milestones
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/milestones.ts
    - scanner: typescript
      file: src/utils/milestone-filter.ts
    - scanner: typescript
      file: src/utils/milestone-storage.ts
      symbol: resolveMilestoneInputForStorage
    - scanner: typescript
      file: src/mcp/tools/milestones/handlers.ts
    - scanner: typescript
      file: src/mcp/utils/milestone-resolution.ts
  group: Shared core
description: Milestone records, and grouping tasks by milestone
---

Adds, renames, archives and removes milestone files, optionally updating, clearing or reassigning the tasks that reference them, and resolves milestone names, IDs and aliases the same way everywhere. One set of milestone handlers serves the CLI milestone commands, the web server and the MCP milestone tools; the grouping helpers drive milestone lanes and filters.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/mcp/tools/milestones/handlers.ts](../../../../../../src/mcp/tools/milestones/handlers.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Renames and archives milestones | In-process call |
