---
id: task-290
title: Fix backlog-jira Backlog CLI subprocess path issue
status: Done
assignee:
  - '@codex'
created_date: '2025-10-12 14:34'
updated_date: '2025-10-12 14:44'
labels:
  - backlog-jira
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When backlog-jira pull command invokes the Backlog CLI via subprocess, it fails with a path error looking for '.backlog/tasks' with a null byte. The CLI works fine when invoked directly but fails when called from the backlog-jira integration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backlog CLI subprocess calls work without path errors
- [x] #2 Pull command can successfully read task details via CLI
- [x] #3 Path handling is correct across different working directories
- [x] #4 No null bytes appear in file paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Investigate how tasksDir is being set and why it contains a null byte
2. Check if the issue is in FileSystem.tasksDir getter or in Core initialization
3. Add validation/sanitization for paths to remove null bytes
4. Test the fix with both direct CLI calls and subprocess calls
5. Update backlog-jira integration tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Issue Details

During testing of backlog-jira pull functionality, discovered that the Backlog CLI fails when invoked via subprocess.

## Error Observed
```
ENOENT: no such file or directory, open '/Users/eciuca/workspace/eciuca/Backlog.md/.backlog/tasks\u0000'
```

## Test Context
- Created task-289 for testing
- Created mapping: task-289 -> S20-291
- Ran: `bun run backlog-jira/src/cli.ts pull task-289 --dry-run`
- Direct CLI works: `backlog task task-289 --plain` ✓
- Subprocess call fails with path error

## Investigation Areas
1. Check BacklogClient.execute() in `backlog-jira/src/integrations/backlog.ts`
2. Investigate null byte in path string
3. Verify working directory handling
4. Check if Backlog CLI has issues with being spawned as subprocess
5. May need to update Backlog CLI itself if issue is in core

## Files Involved
- `backlog-jira/src/integrations/backlog.ts` (BacklogClient)
- Possibly core Backlog CLI in `src/cli.ts`

## Root Cause

Globally installed backlog CLI binary contains old compiled version with hardcoded `.backlog/tasks` paths. Platform-specific npm packages need to be rebuilt and republished.

## Solution

For now: Install the latest built binary locally. This resolves the subprocess path issue.
<!-- SECTION:NOTES:END -->
