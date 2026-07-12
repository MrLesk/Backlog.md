---
id: BACK-395
title: 'Web: prevent stale SPA loads by disabling index.html caching'
status: Done
assignee:
  - '@codex'
created_date: '2026-02-22 12:32'
updated_date: '2026-04-26 10:10'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/web/index.html
  - 'https://github.com/MrLesk/Backlog.md/issues/611'
modified_files:
  - src/server/index.ts
  - src/web/index.html
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
2. Kept Bun's HTML import serving model intact. Based on Bun docs and generated bundle inspection, production HTML imports become an `HTMLBundle` manifest with per-file headers, so the server fix mutates only the HTML entry file headers in that manifest to add no-store directives.
3. Added one shared no-store header helper and reused it for existing fallback GET/HEAD responses.
4. Added the steady-state stale-shell recovery in `src/web/index.html`: an inline head script fetches the current page with `cache: "no-store"`, parses the fresh HTML, compares stylesheet/module asset references against the currently loaded shell, and reloads once with `__backlog_reload=<timestamp>` when they differ.
5. Left obsolete hashed chunk URLs as normal missing assets; recovery is intentionally owned by the cached HTML shell once this version has shipped.
6. Added focused tests for the index-shell guard, compiled HTML manifest header mutation, and unchanged `/assets/*` cache behavior.
7. Verified with targeted tests, typecheck, Biome, full test suite, `bun run build`, and a manual compiled-binary check against `backlog browser`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Revised per user architecture feedback: moved stale frontend recovery into `src/web/index.html` rather than serving a recovery module for stale hashed chunk URLs. This means the first upgrade to the fixed version relies on the no-store server header, and the client-side asset-signature self-check protects subsequent upgrades once users have an HTML shell containing the guard.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented stale browser UI recovery using Bun's serving model plus an index-shell self-check.

Changes:
- Mutate Bun's production `HTMLBundle` manifest so the SPA HTML entry is served with `Cache-Control: no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, and `Expires: 0` while preserving hashed JS/CSS asset behavior.
- Reuse a shared no-store helper for fallback GET/HEAD responses.
- Added an inline head script in `src/web/index.html` that fetches the current route with `cache: "no-store"`, compares frontend asset references, and reloads once with `__backlog_reload` if the loaded shell points at stale assets.
- Added regression coverage for the shipped index-shell guard, production manifest header mutation, and unchanged `/assets/*` cache headers.

Verification:
- `bun test src/test/server-cache.test.ts src/test/server-assets.test.ts`
- `bunx tsc --noEmit`
- `bun run check .`
- `bun run build`
- Manual compiled binary check: `GET /` returns no-store headers and includes the shell-refresh guard; obsolete chunk URLs remain normal 404 fallback responses.
- `bun test` passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
