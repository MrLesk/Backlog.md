---
id: BACK-636
title: Fail closed on ambiguous draft identities
status: To Do
assignee: []
created_date: '2026-08-15 14:00'
labels: []
dependencies: []
priority: medium
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex finding on PR #916 (BACK-634), pre-existing class. Two draft files sharing the same DRAFT-n identity are both shown by the Drafts page, but loadDraft resolves first-match, so an edit or promote through any surface that reaches editTaskOrDraft (web PUT /api/tasks/DRAFT-n since #916, MCP task_edit since #430) can rewrite or promote a different same-ID draft than the one the user saw. Tasks, documents, and decisions fail closed on ambiguous identities (AmbiguousTaskIdError / BACK-580); drafts never got that treatment. Align drafts: detect duplicate draft identities, fail closed with a conflict-style error naming the candidate files, and add doctor coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Draft resolution fails closed with an error naming candidate files when multiple drafts share an identity
- [ ] #2 Web and MCP draft edit/promote paths surface the conflict instead of mutating an arbitrary match
- [ ] #3 doctor reports duplicate draft identities
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
