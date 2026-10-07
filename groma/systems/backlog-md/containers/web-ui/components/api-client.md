---
type: C4 Component
title: API client
status: stable
groma:
  id: api-client
  parent: web-ui
  code:
    - scanner: typescript
      file: src/web/lib/api.ts
  technology: fetch, JSON over HTTP
description: Typed client for the local web server's JSON API
---

The one place where the browser calls the server: tasks, search, docs, decisions, milestones, config, statistics, cleanup, duplicate repair and project setup. It turns error responses into typed errors, including identity conflicts the server refuses with HTTP 409, so pages can show a clear message instead of retrying.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | [src/server/index.ts](../../../../../../src/server/index.ts) | Calls the JSON API | HTTP |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | [src/server/index.ts](../../../../../../src/server/index.ts) | Calls HTTP endpoints: DELETE /api/milestones/:id, GET /api/config, GET /api/decision/:id, GET /api/decisions, GET /api/decisions/:id, GET /api/doc/:id, GET /api/docs, GET /api/docs/:id, GET /api/milestones, GET /api/milestones/:id, GET /api/milestones/archived, GET /api/statuses, POST /api/decisions, POST /api/docs, POST /api/milestones, POST /api/milestones/:id/archive, PUT /api/config, PUT /api/decisions/:id, PUT /api/docs/:id, PUT /api/milestones/:id | typescript |
