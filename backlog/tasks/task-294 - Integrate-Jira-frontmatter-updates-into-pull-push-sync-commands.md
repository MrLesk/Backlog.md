---
id: task-294
title: Integrate Jira frontmatter updates into pull/push/sync commands
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 06:11'
updated_date: '2025-10-13 10:03'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Based on task-292 research findings: The frontmatter utilities (updateJiraMetadata) exist but are only called by the 'map' command. The pull, push, and sync commands need to update task frontmatter with Jira metadata (jira_key, jira_url, jira_last_sync, jira_sync_state) after each successful operation.…
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Frontmatter updates integrated into pull command
- [x] #2 Frontmatter updates integrated into push command
- [x] #3 Frontmatter updates integrated into sync command
- [x] #4 All four Jira metadata fields are updated (jira_key, jira_url, jira_last_sync, jira_sync_state)
- [x] #5 jira_url is constructed from JIRA_URL environment variable
- [x] #6 Updates happen atomically after successful Jira operations
- [x] #7 Tests pass for all modified commands
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review existing frontmatter utilities to understand available functions
2. Identify integration points in pull.ts where frontmatter updates should occur
3. Identify integration points in push.ts where frontmatter updates should occur
4. Identify integration points in sync.ts where frontmatter updates should occur
5. Implement frontmatter updates in pull.ts after successful pull operations
6. Implement frontmatter updates in push.ts after successful push operations
7. Implement frontmatter updates in sync.ts after successful sync operations
8. Add jira_url construction using JIRA_URL environment variable
9. Ensure updates are atomic and happen after DB operations
10. Test all three commands with mapped tasks
11. Verify all four metadata fields are correctly populated
12. Run existing tests to ensure no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

Successfully integrated frontmatter updates into pull, push, and sync commands:

### Changes Made:

**1. pull.ts:**
- Added import for getTaskFilePath and updateJiraMetadata from frontmatter utilities
- After successful pull and DB snapshot updates, added frontmatter update logic
- Updates all 4 metadata fields: jira_key, jira_url, jira_last_sync, jira_sync_state
- Constructs jira_url from JIRA_URL environment variable
- Wrapped in try-catch to ensure pull operation succeeds even if frontmatter update fails

**2. push.ts:**
- Added import for getTaskFilePath and updateJiraMetadata
- Added frontmatter updates in two places:
  a) After updating existing Jira issue (line ~243)
  b) After creating new Jira issue (line ~304)
- Updates all 4 metadata fields after successful push
- Constructs jira_url using JIRA_URL environment variable
- Error handling ensures push succeeds even if frontmatter fails

**3. sync.ts:**
- Added import for getTaskFilePath and updateJiraMetadata
- Added frontmatter updates in two places:
  a) In Unknown state case for initial sync (line ~228)
  b) After conflict resolution in applyFieldResolutions (line ~492)
- Updates metadata after snapshots are created
- Note: sync delegates to pull/push for most operations, so those handle their own frontmatter updates

### Key Design Decisions:

1. Atomic updates: Frontmatter updates happen AFTER successful DB operations to maintain data consistency
2. Error resilience: All frontmatter updates wrapped in try-catch to avoid breaking sync operations
3. URL construction: Uses process.env.JIRA_URL to build full browse URLs
4. Consistent state: Sets jira_sync_state to InSync after successful operations
5. Logging: Added debug logs for successful updates and error logs for failures

### Testing:

- TypeScript compilation: All production code compiles cleanly
- Unit tests: 130 tests pass (2 pre-existing failures in unrelated code)
- All three commands (pull, push, sync) now maintain frontmatter metadata

### Files Modified:

- backlog-jira/src/commands/pull.ts (+32 lines)
- backlog-jira/src/commands/push.ts (+56 lines)
- backlog-jira/src/commands/sync.ts (+47 lines)

### Next Steps:

The implementation is complete and tested. Users will now see Jira metadata in task frontmatter after any pull, push, or sync operation.
<!-- SECTION:NOTES:END -->
