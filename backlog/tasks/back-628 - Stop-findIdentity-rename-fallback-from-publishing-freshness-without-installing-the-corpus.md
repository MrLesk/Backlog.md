---
id: BACK-628
title: >-
  Stop findIdentity rename fallback from publishing freshness without installing
  the corpus
status: To Do
assignee: []
created_date: '2026-08-10 06:37'
labels: []
dependencies: []
priority: medium
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing defect found during the PR #899 (BACK-624) verification round; it reproduces on the PR #898 base too, so it is not a #899 regression. When a task file is renamed or deleted away with no matching local candidate, ContentStore.findIdentity's fallback (src/core/content-store.ts:1051 at head 48ecde4d of tasks/back-624-shared-task-loading) loads the full corpus through the publishing loader purely for a single-task identity lookup and never installs the result. That advances activeBranchFingerprint, so a branch tip that moved just before is then treated as already-seen: reproduced serving stale branch state indefinitely until the next ref or config change. Narrow trigger (deleting a task with no branch-side copy; branch-fallback hydration otherwise forces a healing refresh) and self-heals on any later ref change. Fix direction: findIdentity should either install the corpus it loaded or use a non-publishing load; note refreshTasksFromDisk's publish-on-equal-corpus at :1591 must keep publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The findIdentity fallback either installs the corpus it loads or performs a non-publishing load
- [ ] #2 The reviewer's repro (tip move, then rename/delete of a task with no branch copy, then read) serves fresh branch state
- [ ] #3 Publish-on-equal-corpus behavior in refreshTasksFromDisk is preserved
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
