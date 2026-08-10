---
id: BACK-625
title: Align MCP task reads with the CLI local-first approach
status: To Do
assignee: []
created_date: '2026-08-10 06:10'
labels: []
dependencies: []
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner ruling (2026-08-10, BACK-623/BACK-624 fix round): CLI task commands are local-only (working copy active + completed) because that is what makes the product usable; web stays cross-branch on its long-lived store. MCP should follow the CLI approach: route MCP single-task reads, edits, and validation through the same local working-copy resolution the CLI uses, instead of the cross-branch corpus. Keep fail-closed local ambiguity behavior. Not part of the v1.50.x hotfix release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MCP task view/edit resolve IDs through the same local active+completed resolution as the CLI, with fail-closed ambiguity
- [ ] #2 MCP responses for a task that exists only on another branch match the CLI behavior, including the branch-aware not-found hint
- [ ] #3 No MCP task read or edit triggers remote fetches or cross-branch corpus loads
- [ ] #4 Existing MCP cross-branch consumers that must keep corpus access (if any) are identified and documented in the task before implementation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
