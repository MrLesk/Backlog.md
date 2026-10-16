---
type: C4 Component
title: Web server
status: stable
groma:
  id: web-server
  parent: backlog-cli
  code:
    - scanner: typescript
      file: src/server/index.ts
    - scanner: typescript
      file: src/utils/browser-launch.ts
    - scanner: typescript
      file: src/utils/browser-loading-state.ts
  technology: Bun.serve, HTTP, WebSocket
description: Local HTTP and WebSocket server behind backlog browser
---

Started by `backlog browser`. It listens on 127.0.0.1 (port 6420 by default), so other machines cannot reach it. It serves the bundled web UI, exposes a JSON API for tasks, drafts, docs, decisions, milestones, config, search, statistics and project setup, and keeps one long-lived core with file watchers. When the content store reports a change it sends tasks-updated, milestones-updated or config-updated over WebSocket so open browsers refresh.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/core/backlog.ts](../../../../../../src/core/backlog.ts) | Reads and changes tasks | In-process call |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/core/content-store.ts](../../../../../../src/core/content-store.ts) | Reads the snapshot | In-process call |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/core/search-service.ts](../../../../../../src/core/search-service.ts) | Searches content | In-process call |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/core/statistics.ts](../../../../../../src/core/statistics.ts) | Computes statistics | In-process call |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/mcp/tools/milestones/handlers.ts](../../../../../../src/mcp/tools/milestones/handlers.ts) | Renames and removes milestones | In-process call |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/web/main.tsx](../../../../../../src/web/main.tsx) | Serves the app bundle | HTTP |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Pushes change notices | WebSocket |
| [src/server/index.ts](../../../../../../src/server/index.ts) | [src/core/task-detail.ts](../../../../../../src/core/task-detail.ts) | Builds task details | In-process call |
