---
id: task-293
title: Fix backlog-jira status command hanging after completion
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 06:03'
updated_date: '2025-10-13 08:40'
labels:
  - jira
  - bug
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The status command successfully displays the sync status but doesn't exit/return control to the terminal. The process needs to be interrupted with Ctrl+C.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Investigate why status command doesn't exit cleanly
- [x] #2 Ensure all async operations complete and close properly
- [x] #3 Verify MCP client connection is closed after status command
- [x] #4 Test that status command exits cleanly after displaying results
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze the issue: JiraClient holds an MCP connection that isn't closed after status command\n2. Solution: Add jira.close() call in the finally block of getStatus() function\n3. Test: Run status command and verify it exits cleanly without hanging\n4. Verify: Check that all resources are properly cleaned up
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed the hanging status command by addressing two issues:

1. **Added jira.close() in finally block**: The JiraClient maintains an MCP connection via Docker that wasn't being closed after the status command completed. Added `await jira.close()` in the finally block alongside `store.close()` to ensure the MCP client connection is properly terminated.\n\n2. **Added explicit process.exit(0)**: The pino-pretty logger transport creates a child process that keeps the event loop alive even after all async operations complete. Added `process.exit(0)` after successful status command execution to ensure the process terminates cleanly.\n\n**Testing**: Verified that the status command now exits immediately after displaying results, both when there are no mappings and when processing tasks.\n\n**Files modified**:\n- `backlog-jira/src/commands/status.ts`: Added `await jira.close()` in finally block (line 140) and `process.exit(0)` after successful completion (line 198)
<!-- SECTION:NOTES:END -->
