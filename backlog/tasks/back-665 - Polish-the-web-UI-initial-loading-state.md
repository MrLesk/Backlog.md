---
id: BACK-665
title: Polish the web UI initial loading state
status: To Do
assignee: []
created_date: '2026-08-30 21:48'
labels:
  - web
  - enhancement
dependencies: []
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The pre-board loading state still shows a large plain square/spinner (maintainer: "the old ugly square"), and the dev-served bundle renders a giant unconstrained loading SVG (~13k px) before the board mounts. Replace the initial loading state with a small, design-consistent indicator matching the polish standard set by the indexing chip (BACK-654), constrain or fix the oversized SVG, and keep the first-load skeleton behavior from BACK-654 (loading shell only before first successful load).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The initial load shows a compact, design-consistent indicator in light and dark themes; no oversized square or unconstrained SVG at any point
- [ ] #2 Post-first-load refreshes still never show the blocking shell
- [ ] #3 jsdom tests cover the loading state; visual pass by the maintainer
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
