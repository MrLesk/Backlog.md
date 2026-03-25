---
id: BACK-395
title: 'Web: prevent stale SPA loads by disabling index.html caching'
status: To Do
assignee:
  - '@codex'
created_date: '2026-02-22 12:32'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/web/index.html
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser view can serve stale frontend assets after updates because the SPA shell (`index.html`) is cached and references non-hashed local asset paths (for example `./styles/style.css` and `./main.tsx`). Research indicates SPA routes are served via Bun `routes` (`"/": indexHtml`, `"/tasks": indexHtml`, etc.) while cache headers are currently set in the `fetch` handler path, which may not consistently cover those route responses. We should ensure `index.html` is never cached for local browser usage so updated CSS/JS load reliably.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Requests for SPA HTML entry routes (`/`, `/tasks`, `/milestones`, `/drafts`, `/documentation`, `/decisions`, `/statistics`, `/settings`) return non-cacheable headers for index content (for example `Cache-Control: no-store`).
- [ ] #2 After frontend changes and server restart, reopening/refreshing the browser view loads current CSS/JS without requiring hard refresh or cache clear.
- [ ] #3 Automated test coverage verifies cache headers for SPA HTML routes to prevent regression.
- [ ] #4 Behavior for non-HTML responses (API/assets) remains intentionally defined and unchanged unless explicitly required by the fix.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
