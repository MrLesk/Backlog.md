---
type: C4 Component
title: Dependencies and readiness
status: stable
groma:
  id: dependencies
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/task-detail.ts
    - scanner: typescript
      file: src/utils/dependency-graph.ts
    - scanner: typescript
      file: src/utils/readiness.ts
    - scanner: typescript
      file: src/utils/task-subtasks.ts
    - scanner: typescript
      file: src/utils/task-record-index.ts
    - scanner: typescript
      file: src/utils/task-links.ts
  group: Shared core
description: Dependency graphs, readiness and subtask summaries for task details
---

Loads the set of records a read may resolve against and builds each task's detail: what it depends on, what depends on it, whether it is ready or blocked, and its subtasks. It finds dependency cycles and strips links to tasks that were archived or demoted. The CLI, the terminal UI, the web server and the MCP tools all use it.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/core/task-detail.ts](../../../../../../src/core/task-detail.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Queries the task corpus | In-process call |
