---
id: BACK-608
title: Remove gray-matter cache poisoning with a shared no-cache parse wrapper
status: To Do
assignee: []
created_date: '2026-08-08 15:56'
labels: []
dependencies: []
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
gray-matter caches parse results keyed by input string and hands back the same object, which poisoned parsing twice independently during the Aug 2026 review rounds (worked around locally via an options object in one place and Bun.YAML.parse in another). Introduce one shared frontmatter parse helper that disables the cache and migrate every gray-matter call site to it so the whole defect class is gone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A single shared frontmatter parse helper disables the gray-matter cache
- [ ] #2 No direct gray-matter usage remains outside the shared helper
- [ ] #3 A regression test demonstrates the former cache-poisoning scenario now parses correctly
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
