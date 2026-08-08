---
id: BACK-611
title: Remove dead TUI view files and duplicated helpers
status: To Do
assignee: []
created_date: '2026-08-08 21:53'
labels: []
dependencies: []
ordinal: 250000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by Alex on 2026-08-08. Two cleanups, both confirmed during the Aug 2026 review rounds: (1) src/ui/enhanced-views.ts (runEnhancedViews) and src/ui/simple-unified-view.ts (runSimpleUnifiedView) have zero importers outside themselves (verified twice, in the BACK-605 implementation and its review) and only received plumbing churn in BACK-605; delete them and their now-unused exports/tests. (2) src/cli.ts carries an unused duplicate of generateNextDocId that also lives in src/utils/id-generators.ts; remove the duplicate and keep the shared one. Re-verify zero usages at implementation time before deleting.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 src/ui/enhanced-views.ts and src/ui/simple-unified-view.ts are deleted along with any exports and tests that exist only for them
- [ ] #2 The duplicated generateNextDocId in src/cli.ts is removed in favor of the shared helper
- [ ] #3 A repo-wide search confirms no remaining references to the deleted symbols
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
