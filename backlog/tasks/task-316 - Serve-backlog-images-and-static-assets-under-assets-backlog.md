---
id: task-316
title: Serve backlog images and static assets under /assets/backlog
status: In Progress
assignee:
  - '@codex'
created_date: '2025-11-11 14:24'
updated_date: '2025-11-11 17:59'
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

It will work if this image is displayed in the markdown preview AND when served from the backlog server:

![Example Image](../assets/images/web.jpeg)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Files under the `backlog/assets` directory are reachable at `/assets/<relative-path>` when `backlog browser` runs.
- [x] #2 Requests that attempt path traversal (contain `..`) are rejected with 404.
- [x] #3 Common image types (png/jpg/jpeg/gif/svg/webp/avif) are served with a correct Content-Type header.
- [x] #4 Missing files return 404; server errors return 500 and are logged.
- [x] #5 Documentation added explaining how to reference assets in Markdown and examples.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Goal
- Serve static files placed under `backlog/assets` at HTTP paths under `/assets/<relative-path>` when `backlog browser` runs.

High-level steps
1. Server: add route and handler
   - Add a Bun route for `GET /assets/*` in `src/server/index.ts`.
   - Implement a handler `handleAssetRequest(req: Request)` that:
     - Resolves the request path relative to `<projectRoot>/backlog/assets`.
     - Decodes URL components and rejects paths containing `..` immediately.
     - Derives backlog root via `this.core.filesystem.docsDir` parent to avoid changing FileSystem API.
     - Uses `join(backlogAssetsRoot, relPath)` and verifies the resolved path starts with the assets root.
     - Uses `Bun.file()` to serve the file and sets Content-Type using a small extension-based map for common types (png/jpg/jpeg/gif/svg/webp/avif/pdf/txt/css/js). Falls back to `application/octet-stream`.
     - Returns 404 when the file does not exist, and 500 on errors (with logging).

2. Tests: functional use-cases
   - Add tests under `src/test/server-assets.test.ts` that:
     - Create a test project dir using `createUniqueTestDir` and call `filesystem.ensureBacklogStructure()`.
     - Create `backlog/assets/images/test.png` and `backlog/assets/docs/readme.txt` with known contents.
     - Start `BacklogServer(TEST_DIR)` on ephemeral port `server.start(0, false)`.
     - Verify `GET /assets/images/test.png` returns 200, Content-Type `image/png`, and body content matches.
     - Verify `GET /assets/docs/readme.txt` returns 200, Content-Type `text/plain`, and body content matches.
     - Verify missing file returns 404.
     - Verify path traversal attempts (`/assets/../config.yml` and encoded `%2e%2e`) return 404.

3. CI / checks
   - Ensure `npx biome check .` passes (format imports and regexes) — run formatter if needed.
   - Tests require Bun runtime to run; document this in PR body and/or add GitHub Actions to run tests with Bun.

Edge cases & considerations
- Symbolic links: the handler uses path normalization; consider symlink resolution if repo allows symlinks under backlog/assets.
- Large files: consider streaming with proper headers; for now Bun.file uses efficient serving.
- Caching headers: consider `Cache-Control` or `ETag` in follow-ups.
- MIME map: use a small builtin map initially; optionally add `mime` package later for full coverage.

<!-- SECTION:NOTES:END -->
