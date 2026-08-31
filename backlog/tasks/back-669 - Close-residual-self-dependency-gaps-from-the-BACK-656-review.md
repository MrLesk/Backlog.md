---
id: BACK-669
title: Close residual self-dependency gaps from the BACK-656 review
status: To Do
assignee: []
created_date: '2026-08-31 00:26'
labels:
  - cli
  - bug
dependencies: []
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two residual defects deferred at PR #978 merge, both small: (1) a legacy draft carrying a dangling dependency reference equal to the NEXT allocated task ID slips past validation on promotion — resolveUniqueDependency returns null, the invalid list is ignored on that path, and the unchanged reference is written under the newly allocated ID as a direct self-dependency (demotion has the mirror problem with draft IDs); check references against the allocated target before corpus resolution even when unresolved. (2) doctor --fix bases its final dependency-findings exit status on the pre-repair snapshot, so a self-dependency that the duplicate-ID repair itself resolves still reports remaining findings and exits 1; re-run findDependencyDefects after repairDuplicateTaskIds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Promoting or demoting a record with a dangling reference equal to the allocated ID is rejected; no self-dependency can be written
- [ ] #2 doctor --fix exit status reflects the post-repair corpus
- [ ] #3 Tests cover both scenarios
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
