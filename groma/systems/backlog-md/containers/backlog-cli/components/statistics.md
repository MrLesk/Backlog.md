---
type: C4 Component
title: Statistics
status: stable
groma:
  id: statistics
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/statistics.ts
    - scanner: typescript
      file: src/commands/overview.ts
      symbol: runOverviewCommand
    - scanner: typescript
      file: src/ui/overview-tui.ts
      symbol: renderOverviewTui
  group: Shared core
description: Project statistics for backlog overview and the web statistics page
---

Counts tasks by status and priority, measures completion, and lists recent activity, stale tasks and blocked tasks. `backlog overview` renders the result in the terminal, and the web server returns the same numbers to the statistics page.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/commands/overview.ts](../../../../../../src/commands/overview.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Loads tasks | In-process call |
