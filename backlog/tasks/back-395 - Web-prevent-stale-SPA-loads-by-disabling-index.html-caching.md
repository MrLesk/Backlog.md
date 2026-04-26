---
id: BACK-395
title: 'Web: prevent stale SPA loads by disabling index.html caching'
status: Done
assignee:
  - '@codex'
created_date: '2026-02-22 12:32'
updated_date: '2026-04-26 08:36'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/web/index.html
  - 'https://github.com/MrLesk/Backlog.md/issues/611'
modified_files:
  - src/server/index.ts
  - src/test/server-cache.test.ts
  - src/test/server-assets.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser view can serve stale frontend assets after updates because the SPA shell (`index.html`) is cached and references non-hashed local asset paths (for example `./styles/style.css` and `./main.tsx`). Research indicates SPA routes are served via Bun `routes` (`"/": indexHtml`, `"/tasks": indexHtml`, etc.) while cache headers are currently set in the `fetch` handler path, which may not consistently cover those route responses. We should ensure `index.html` is never cached for local browser usage so updated CSS/JS load reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Requests for SPA HTML entry routes (`/`, `/tasks`, `/milestones`, `/drafts`, `/documentation`, `/decisions`, `/statistics`, `/settings`) return non-cacheable headers for index content (for example `Cache-Control: no-store`).
- [x] #2 After frontend changes and server restart, reopening/refreshing the browser view loads current CSS/JS without requiring hard refresh or cache clear.
- [x] #3 Automated test coverage verifies cache headers for SPA HTML routes to prevent regression.
- [x] #4 Behavior for non-HTML responses (API/assets) remains intentionally defined and unchanged unless explicitly required by the fix.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduced the stale-cache surface locally by starting `BacklogServer` from source and fetching SPA routes: exact Bun HTML-import routes returned `cache-control=null`, confirming the existing fallback `fetch` no-cache headers do not apply to matched routes.
2. Kept Bun's HTML import serving model intact. Based on Bun docs and generated bundle inspection, production HTML imports become an `HTMLBundle` manifest with per-file headers, so the fix mutates only the HTML entry file headers in that manifest to add no-store directives.
3. Added one shared no-store header helper and reused it for existing fallback GET/HEAD responses.
4. Added a narrow stale hashed frontend script fallback for obsolete `/chunk-*.js` and `/index-*.js` requests. This returns a tiny one-shot module that reloads the current page with `__backlog_reload=<timestamp>`, allowing already-cached old app shells to recover instead of staying stuck on 404 chunk URLs.
5. Added focused tests for the stale script recovery path, compiled HTML manifest header mutation, and unchanged `/assets/*` cache behavior.
6. Verified with targeted tests, typecheck, Biome, full test suite, `bun run build`, and a manual compiled-binary check against `backlog browser`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
GitHub issue #611 reports the same stale SPA shell/chunk problem after upgrading backlog.md 1.44.0: Chrome kept an old index/app shell that requested obsolete hashed chunk filenames. Work will continue under this existing task rather than duplicate BACK-446.

Context brief for implementation: L1 bounded server behavior fix. Bun docs reviewed: `Bun.serve` HTML imports are intended to be mounted directly in `routes`; production/runtime bundling enables cache/ETag headers, and route responses can carry explicit custom headers. Current `src/server/index.ts` sets no-cache headers only in the fallback `fetch` handler, which exact SPA routes bypass. Planned fix is a narrow server-side wrapper for SPA HTML route responses, not a rewrite of asset serving.

Reproduction evidence: before the fix, a source `BacklogServer` fetch of `/`, `/tasks`, and `/documentation/example` returned 200 with `cache-control=null`, showing exact SPA routes bypassed the existing fallback no-cache header logic. Compiled binary verification after the fix: `GET /` returned `Cache-Control: no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, and `Expires: 0`; `GET /chunk-t1h94j9b.js` returned 200 JavaScript reload recovery with the same no-store headers. The first full-suite run exposed an unrelated/order-sensitive milestone expectation in `server-search-endpoint.test.ts`; that file passed alone, and a second full-suite run exited 0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented stale browser UI recovery for Bun-served frontend assets without replacing the serving stack.

Changes:
- Mutate Bun's production `HTMLBundle` manifest so the SPA HTML entry is served with `Cache-Control: no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, and `Expires: 0` while preserving hashed JS/CSS asset caching behavior.
- Reuse a shared no-store helper for fallback GET/HEAD responses.
- Add a narrow recovery response for obsolete hashed frontend script URLs (`/chunk-*.js`, `/index-*.js`) so an already-cached stale app shell can execute a one-shot reload with a cache-busting query instead of remaining stuck on a 404 chunk.
- Added regression coverage for stale script recovery, production manifest header mutation, and unchanged `/assets/*` cache headers.

Verification:
- `bun test src/test/server-cache.test.ts src/test/server-assets.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
- `bun run build`
- Manual compiled binary check: `GET /` returns no-store headers; `GET /chunk-t1h94j9b.js` returns the reload module with no-store headers.
- `bun test` passed on rerun after an unrelated/order-sensitive milestone test failure passed in isolation.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
