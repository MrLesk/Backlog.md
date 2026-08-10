---
id: BACK-630
title: Filter the web dependency picker to locally-resolvable tasks
status: To Do
assignee: []
created_date: '2026-08-10 07:12'
labels: []
dependencies: []
priority: medium
ordinal: 266000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the PR #898 (BACK-623) verification round. Since dependency validation moved to local working-copy resolution (owner ruling: CLI/core local-only), the browser dependency picker still suggests the cross-branch corpus (src/web/components/DependencyInput.tsx availableTasks from App's search corpus, TaskDetailsModal.tsx), so picking a branch-only task now fails on save with a missing-dependency error whose hint says to use 'backlog browser' - confusing when the user is already in the browser. On v1.50.0 this save succeeded, so it is a known, accepted web-surface regression of the local-only ruling, deferred from the v1.50.1 hotfix. Filter the picker to tasks that local validation will accept, and adjust the web-surface error copy so it does not tell browser users to open the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The dependency picker only suggests tasks local validation accepts
- [ ] #2 A rejected dependency save in the web UI shows copy appropriate for the web surface
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
