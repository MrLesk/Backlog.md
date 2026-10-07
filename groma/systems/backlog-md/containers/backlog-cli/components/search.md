---
type: C4 Component
title: Search
status: stable
groma:
  id: search
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/core/search-service.ts
      symbol: SearchService
    - scanner: typescript
      file: src/utils/task-search.ts
    - scanner: typescript
      file: src/utils/task-id-search.ts
      symbol: createTaskIdSearchVariants
    - scanner: typescript
      file: src/utils/label-filter.ts
    - scanner: typescript
      file: src/utils/modified-files.ts
    - scanner: typescript
      file: src/utils/status-filter.ts
  group: Shared core
  technology: Fuse.js
description: Fuzzy search and the task filters shared by every surface
---

Builds a fuzzy index over tasks, documents and decisions and keeps it in step with the content store. It also owns the one set of task filters (text, status, type, project, priority, assignee, labels, milestone, parent and modified files) used by the CLI, the terminal UI, the web server and the MCP tools.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/core/search-service.ts](../../../../../../src/core/search-service.ts) | [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | Indexes the snapshot | Subscription |
