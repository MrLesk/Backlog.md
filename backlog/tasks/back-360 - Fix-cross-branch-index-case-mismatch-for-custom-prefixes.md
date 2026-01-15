---
id: BACK-360
title: Fix cross-branch index case mismatch for custom prefixes
status: Done
assignee:
  - '@codex'
created_date: '2026-01-15 20:01'
updated_date: '2026-01-15 20:02'
labels:
  - bug
  - cross-branch
  - prefix-config
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
### Why
Code review on BACK-359 identified a case mismatch bug: when `prefixes.task` is set to uppercase/mixed-case (e.g., "JIRA"), the cross-branch index stores keys with original case (`JIRA-123`) but lookup uses lowercase (`jira-123`), causing lookups to fail.

### What
Normalize prefix to lowercase when building cross-branch indexes in `buildRemoteTaskIndex` and `buildLocalBranchTaskIndex`.

### Root Cause
Line 136 and 265 in `task-loader.ts` use `${prefix}-${m[1]}` but should use `${prefix.toLowerCase()}-${m[1]}` to match the lowercase lookup in `findTaskInRemoteBranches`/`findTaskInLocalBranches`.

### Related
- Follow-up to BACK-359
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 buildRemoteTaskIndex stores index keys with lowercase prefix
- [x] #2 buildLocalBranchTaskIndex stores index keys with lowercase prefix
- [x] #3 Cross-branch lookup works with uppercase configured prefix (e.g., JIRA)
- [x] #4 Existing tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation

Fixed both `buildRemoteTaskIndex` (line 136) and `buildLocalBranchTaskIndex` (line 265) to use `${prefix.toLowerCase()}-${m[1]}` instead of `${prefix}-${m[1]}`.

This ensures index keys match the lowercase lookup in `findTaskInRemoteBranches`/`findTaskInLocalBranches`.
<!-- SECTION:NOTES:END -->
