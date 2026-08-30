---
id: BACK-654
title: Polish the cross-branch indexing loading indicator in the web UI
status: To Do
assignee: []
created_date: '2026-08-30 11:55'
labels:
  - web
  - enhancement
dependencies: []
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While the web UI indexes other local branches it shows a spinner with the text "Indexing 35 other local branches...". The maintainer wants this indicator improved as part of the UI delight effort. The implementer proposes the concrete design in the plan for review; it must fit the existing web design language, stay unobtrusive, and never block interaction with already-loaded content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cross-branch indexing state is shown with a polished, design-consistent indicator instead of the current spinner-plus-sentence
- [ ] #2 Already-loaded content stays fully interactive while indexing runs
- [ ] #3 The indicator disappears cleanly when indexing completes, including the fast-completion case without flicker
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
