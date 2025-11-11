---
id: task-316
title: Serve backlog images and static assets under /assets/backlog
status: In Progress
assignee:
  - '@codex'
created_date: '2025-11-11 14:24'
updated_date: '2025-11-11 16:48'
labels:
  - server
  - web
  - assets
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow storing images and other static assets inside the project's `backlog/assets` directory and expose them when running the web UI so they can be referenced from tasks, documents and decisions.

Context
- Files should be reachable when the user opens `backlog browser`.
- Assets live anywhere under the `backlog/assets` directory (e.g. `backlog/assets/images/foo.png`, `backlog/assets/uml/diagram.svg`).

Implementation notes
- Add a server route that maps `/assets/<relative-path>` to `<projectRoot>/backlog/assets/<relative-path>`.
- Protect against path traversal (`..`) and ensure resolved path stays inside the backlog root.
- Use `this.core.filesystem.docsDir` (or similar public getter) to derive backlog root to avoid changing FileSystem API.
- Return files via `Bun.file()` (or equivalent) with a small extension-based MIME map for common types (png/jpg/jpeg/gif/svg/webp/avif/pdf); fallback to `application/octet-stream`.
- Document how to reference assets in markdown (recommended URL scheme: `/assets/<relative-path>`).

Notes on UX and compatibility
- Prefer not to rewrite existing markdown automatically; instead document the URL pattern so authors can reference images explicitly.
- Optional follow-ups: add tests for the endpoint, add cache headers, and unify MIME handling with a small package if desired.

Backwards compatibility
- No change to existing FileSystem API is required; the server should only add a read-only route.

References
- `src/server/index.ts` — add route and handler
- `src/core/*` — use existing filesystem getters to compute backlog root

Estimate: small (1–2 days work: implement + doc + tests)

It will work if this image is displayed in the markdown preview AND when served from the backlog server:

![Example Image](../assets/images/web.jpeg)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Files under the `backlog/assets` directory are reachable at `/assets/<relative-path>` when `backlog browser` runs.
- [ ] #2 Requests that attempt path traversal (contain `..`) are rejected with 404.
- [ ] #3 Common image types (png/jpg/jpeg/gif/svg/webp/avif) are served with a correct Content-Type header.
- [ ] #4 Missing files return 404; server errors return 500 and are logged.
- [ ] #5 Documentation added explaining how to reference assets in Markdown and examples.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation: added `/assets/*` route and `handleAssetRequest` in `src/server/index.ts`. The server serves files from `<projectRoot>/backlog/assets/<relative-path>` with path normalization and basic MIME mapping.
<!-- SECTION:NOTES:END -->
