---
id: BACK-602
title: Close doctor and web gaps from the identity review
status: To Do
assignee: []
created_date: '2026-08-08 07:46'
labels:
  - core
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/872'
priority: medium
type: bug
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two P2 findings from the final Codex review round on PR #872 (BACK-580) were missed before that PR merged. Both are fix-forward.

1. Doctor reports healthy when a whole content directory is unreadable. `listDocuments` and `listDecisions` catch per-file parse errors and record them in the `unreadable` collector, but a failure at the directory-scan level (for example `chmod 000` on `backlog/docs`, or a missing or unreadable directory) is caught by the outer try/catch, which returns an empty array without touching the collector. `Core.diagnoseContentIdentity` (src/core/backlog.ts, around line 293) then sees zero entries and zero unreadable paths, so `backlog doctor` prints that no duplicate IDs were found and exits 0. A directory Backlog could not read must surface as a doctor finding with a non-zero exit, exactly like a per-file parse failure.

2. A stale ambiguity notice blocks the document create route. After a 409 ambiguity error, navigating to `/documentation/new` reuses the mounted component, and the `id === 'new'` branch of the load effect never clears `error` (src/web/components/DocumentationDetail.tsx, around line 298). The ambiguity notice renders instead of the create editor, so the user cannot create a document without a full page reload. `DecisionDetail` has the same load-effect shape and should be checked for the same defect.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog doctor reports an unreadable document or decision directory as a finding and exits non-zero
- [ ] #2 Entering the document create route after an ambiguity error renders the create editor instead of the stale notice
- [ ] #3 The decision detail view is verified against the same stale-error pattern and fixed if affected
- [ ] #4 Tests cover the unreadable-directory finding and the create-route recovery
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
