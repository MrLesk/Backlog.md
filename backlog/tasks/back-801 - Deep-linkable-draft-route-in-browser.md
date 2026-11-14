---
id: BACK-801
title: Deep-linkable draft route in browser
status: In Progress
assignee:
  - '@vinnyduke'
created_date: '2026-11-14 01:25'
updated_date: '2026-11-14 01:28'
labels: []
dependencies: []
priority: medium
type: feature
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser opens tasks directly via /tasks/:id, but the Drafts list has no per-draft route: DraftsList opens the edit modal through local state only. External surfaces (dashboards, links in task descriptions) can link to a task but not to a draft, so drafts are second-class in the web UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening /drafts/:id in the browser opens the drafts view with that draft's edit modal
- [ ] #2 Unknown draft id shows the same invalid-id handling as the task route
- [ ] #3 Existing /tasks/:id and /board/:id behaviour is unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bun run check:types passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server/index.ts: add /drafts/* SPA fallback next to /drafts. 2. App.tsx: match /drafts/:id (and :title), include /drafts in routeBasePath, open route modal with isDraft, route DraftsList edits through navigation. 3. Tests: SPA fallback for /drafts/:id plus draft detail read; run focused tests, check:types, biome. 4. Push branch to fork and open PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented /drafts/:id route (App.tsx matches, routeBasePath, isDraft route modal, DraftsList navigates) plus /drafts/* SPA fallback in server. SPA fallback test extended (29 pass), drafts endpoint tests pass (7), biome clean on 3 files, bun --check clean on changed sources.
<!-- SECTION:NOTES:END -->
