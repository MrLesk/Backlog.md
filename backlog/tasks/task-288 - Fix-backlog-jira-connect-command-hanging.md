---
id: task-288
title: Fix backlog-jira connect command hanging
status: Done
assignee:
  - '@codex'
created_date: '2025-10-12 13:58'
updated_date: '2025-10-12 14:05'
labels:
  - bug
  - backlog-jira
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog-jira connect command successfully verifies connections but the MCP Atlassian server stays running and locks the terminal. The command should complete and return control to the user after verification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Connect command verifies Backlog CLI connection
- [x] #2 Connect command verifies MCP Atlassian connection
- [x] #3 Connect command exits cleanly after verification without locking the terminal
- [x] #4 User can run the command and immediately get their terminal prompt back
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Investigate the MCP client close() behavior
2. Check if the Docker process is being terminated properly
3. Add explicit process.exit() after verification to ensure clean exit
4. Test the fix
5. Verify all acceptance criteria are met
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed the backlog-jira connect command hanging issue by adding explicit process.exit(0) call.

## Changes Made
- Modified `backlog-jira/src/commands/connect.ts` to add `process.exit(0)` after successful connection verification
- This ensures the Node.js event loop exits cleanly and returns control to the terminal immediately

## Technical Details
The issue was that even though the MCP client was properly closed in the `finally` block, the Node.js process was waiting for the event loop to be empty. The Docker container spawned by the MCP client transport was keeping the event loop alive.

By adding an explicit `process.exit(0)`, we force the process to terminate immediately after verification, which:
1. Cleans up the MCP client connection
2. Terminates the Docker container (via --rm flag)
3. Returns control to the terminal

## Testing
Tested successfully with:
- `backlog-jira connect` - exits cleanly with exit code 0
- Terminal prompt returns immediately after verification
- Both Backlog CLI and MCP Atlassian connections verified successfully

## Modified Files
- `backlog-jira/src/commands/connect.ts`
<!-- SECTION:NOTES:END -->
