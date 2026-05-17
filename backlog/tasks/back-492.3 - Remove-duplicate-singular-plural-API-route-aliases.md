---
id: BACK-492.3
title: Remove duplicate singular/plural API route aliases
status: To Do
assignee: []
created_date: '2026-05-17 21:12'
labels:
  - tech-debt
milestone: m-13
dependencies: []
modified_files:
  - src/server/index.ts
parent_task_id: BACK-492
priority: low
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`BacklogServer.start()` (`src/server/index.ts`) registers 4 pairs of routes pointing to the same handler:
- `/api/task/:id` + `/api/tasks/:id` → `handleGetTask`
- `/api/doc/:id` + `/api/docs/:id` → `handleGetDoc`
- `/api/decision/:id` + `/api/decisions/:id` → `handleGetDecision`
- `/sequences` + `/api/sequences` → `handleGetSequences`

These 8 entries reduce to 4 logical routes. The duplicates are likely backward-compat aliases that were never cleaned up. They double the maintenance surface and must be kept in sync on any signature change.

**Implementation plan:**
1. Audit `src/web/lib/api.ts` and any other callers to confirm which form (singular vs plural, prefixed vs unprefixed) is actually used
2. Keep the plural/`/api/`-prefixed form as canonical; remove the legacy aliases
3. Update any caller that used the removed form
4. Add a comment if ambiguity is likely to recur
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 4 duplicate route pairs removed from start()
- [ ] #2 WebUI client (src/web/lib/api.ts) verified to use only canonical routes
- [ ] #3 Existing API integration tests (if any) still pass
- [ ] #4 Manual smoke test: no 404s on task/doc/decision/sequence endpoints
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
