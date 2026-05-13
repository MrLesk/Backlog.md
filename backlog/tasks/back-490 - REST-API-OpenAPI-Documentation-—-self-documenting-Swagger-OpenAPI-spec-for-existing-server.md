---
id: BACK-490
title: >-
  REST API OpenAPI Documentation — self-documenting Swagger/OpenAPI spec for
  existing server
status: To Do
assignee: []
created_date: '2026-05-13 10:14'
labels:
  - rest-api
  - documentation
  - developer-experience
dependencies: []
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Upstream constraint**: This task must be implemented on a clean branch from `upstream-master`. It must be self-contained and mergeable as a single standalone PR with no cross-task code dependencies. If a dependency on another task is unavoidable, it is listed explicitly in the Dependencies section.

The REST API already fully exists in `src/server/index.ts` (~1765 lines, Bun native HTTP server). It has no self-documentation — external consumers must read source code to understand available endpoints, parameters, and response shapes. This task adds an OpenAPI 3.x specification and an interactive UI served directly by the running server.

**No new business logic**: This is purely additive documentation. No endpoints change behavior, no new features are added.

**Approach (code-first preferred)**: Use a minimal TypeScript-first library compatible with Bun that generates the OpenAPI spec from type annotations or decorators on the existing routes. If no suitable code-first library exists for Bun's native HTTP (not Express/Hono/Elysia), a maintained hand-written spec file with a CI lint step (`@stoplight/spectral-cli` or similar) is an acceptable fallback.

**Interactive UI**: Serve one of Swagger UI, Scalar, or Redoc at `GET /api/docs` — choose the smallest production bundle that renders OpenAPI 3.x specs correctly. Bundle must be self-contained (no CDN dependency at runtime).

**Endpoint coverage** (all existing endpoints must be documented):
Tasks, Documents, Milestones, Sequences, Config, Search, Admin (init, status, statistics, version), WebSocket upgrade endpoint (note-only if not fully describable in OpenAPI).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 OpenAPI 3.x spec covers all existing REST endpoints in `src/server/index.ts` (tasks, docs, milestones, sequences, config, search, admin)
- [ ] #2 Spec accessible at `GET /api/openapi.json` (machine-readable JSON)
- [ ] #3 Interactive UI (Swagger UI, Scalar, or Redoc) served at `GET /api/docs` with no CDN dependency
- [ ] #4 All path parameters, query parameters, request bodies, and response shapes documented with types and descriptions
- [ ] #5 Spec stays in sync with implementation: either code-first generation or a CI lint step that fails on spec/code drift (`spectral` or equivalent)
- [ ] #6 Chosen library is lightweight (justify bundle size), well-maintained (recent release, active repo), MIT or Apache 2.0 licensed
- [ ] #7 No behavior changes to any existing endpoint — additive only
- [ ] #8 WebSocket endpoint documented as a note in the spec (or excluded with a comment explaining why)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
