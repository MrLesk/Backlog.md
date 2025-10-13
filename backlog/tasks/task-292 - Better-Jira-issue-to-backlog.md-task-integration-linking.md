---
id: task-292
title: Better Jira issue to backlog.md task integration/linking
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 05:29'
updated_date: '2025-10-13 05:32'
labels:
  - jira
  - integration
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explore and implement improved integration between Jira issues and backlog.md tasks, particularly around linking. Currently when importing Jira issues, there's no clear link back to the original Jira issue in the task header or metadata. This makes it difficult to track the source issue or navigate back to Jira for additional context.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Research current Jira import implementation to understand how issues are currently mapped to tasks
- [x] #2 Identify where and how to store Jira issue links (task metadata, header, or other location)
- [x] #3 Evaluate different linking approaches (URL in header, metadata field, or both)
- [x] #4 Propose a solution for bidirectional linking between Jira issues and backlog.md tasks
- [x] #5 Document findings and recommendations for implementation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research complete: Confirmed that backlog-jira maintains task<->Jira mappings only in SQLite DB (.backlog-jira/jira-sync.db)
2. Analyze current BacklogTask interface and see what fields are available in frontmatter
3. Identify best approach for storing Jira link:
   a) Add jiraKey field to BacklogTask interface and frontmatter
   b) Consider jiraUrl field for direct browser link
   c) Evaluate impact on existing codebase
4. Implement changes to backlog-jira package:
   a) Update BacklogClient to read/write jira metadata
   b) Modify pull/push/sync commands to maintain jiraKey in task frontmatter
   c) Update store operations to sync DB and frontmatter
5. Add backlog-jira command to show Jira links for tasks (backlog-jira show <taskId>)
6. Update documentation on how task<->Jira linking works
7. Test integration thoroughly:
   a) Import new Jira issue and verify jiraKey in frontmatter
   b) Pull/push operations maintain the link
   c) Verify link persistence across sync operations
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research Findings

### Current State:
- backlog-jira package already has frontmatter utilities (`src/utils/frontmatter.ts`)
- Defines 4 Jira metadata fields:
  - `jira_key`: Jira issue key (PROJ-123)
  - `jira_last_sync`: Last sync timestamp
  - `jira_sync_state`: Sync state
  - `jira_url`: Direct URL to Jira issue
- **CRITICAL**: These utilities exist but are NOT being used in pull/push/sync commands!
- Current implementation only maintains mapping in SQLite DB

### Storage Location Identified:
Task frontmatter (YAML) - already has infrastructure in place

### Linking Approaches Evaluation:

#### Approach 1: jira_key only (minimal)
**Pros:**
- Compact, just stores the issue key
- User can construct URL if needed
- Lightweight

**Cons:**
- Requires Jira URL config to construct full URL
- Less convenient for quick access

#### Approach 2: jira_key + jira_url (recommended)
**Pros:**
- Direct browser link available
- Self-contained, no config needed to access issue
- Supports multiple Jira instances
- Better UX for users

**Cons:**
- Slightly more storage
- URL might become stale if Jira URL changes (rare)

#### Approach 3: Full metadata (jira_key + jira_url + jira_last_sync + jira_sync_state)
**Pros:**
- Complete bidirectional link info
- Enables sync status visibility in task
- Helps detect out-of-sync tasks

**Cons:**
- More fields to maintain
- Adds complexity

**RECOMMENDATION**: Approach 3 (Full metadata)
- Infrastructure already exists
- Provides complete context
- Enables future enhancements (sync badges, conflict detection)
- Aligns with design in jira-sync-integration.md plan

### Bidirectional Linking Solution:

#### Problem Statement:
- Frontmatter utilities exist but are ONLY used in map command
- pull/push/sync commands do NOT update task frontmatter
- Users lose link to Jira after sync operations

#### Proposed Solution:

**1. Integrate frontmatter updates into pull.ts:**
   - After successful pull, update jira_last_sync timestamp
   - Update jira_sync_state based on operation result
   - Maintain jira_key and jira_url from mapping

**2. Integrate frontmatter updates into push.ts:**
   - After successful push, update jira_last_sync
   - Update jira_sync_state to "InSync"
   - Ensure jira_key persists

**3. Integrate frontmatter updates into sync.ts:**
   - Update frontmatter after each task sync
   - Set appropriate jira_sync_state for conflicts
   - Keep metadata in sync with SQLite DB

**4. Add jira_url construction:**
   - Read JIRA_URL from environment
   - Construct full URL: ${JIRA_URL}/browse/${jiraKey}
   - Store in frontmatter for easy access

#### Implementation Points:
- Import getTaskFilePath and updateJiraMetadata in pull/push/sync
- Call updateJiraMetadata after DB operations
- Ensure atomic updates (DB + frontmatter together)
- Handle errors gracefully (log but don't fail sync)

## Documentation & Recommendations

### Key Findings Summary:

1. **Infrastructure exists but is underutilized**
   - Frontmatter utilities (`src/utils/frontmatter.ts`) define 4 metadata fields
   - Only `map` command uses these utilities
   - `pull`, `push`, `sync` commands ignore frontmatter entirely

2. **Current workflow breaks linking**
   - User maps task → frontmatter updated ✓
   - User syncs task → frontmatter NOT updated ✗
   - Link information lives only in SQLite DB

3. **Missing pieces:**
   - No jira_url field population (URL not stored)
   - No frontmatter updates during sync operations
   - No visibility of sync state in task files

### Recommendations:

**Priority 1: Fix sync commands (High Impact)**
- Modify `pull.ts`, `push.ts`, `sync.ts` to call `updateJiraMetadata`
- Update after each successful operation
- Store complete link information in frontmatter

**Priority 2: Add URL construction (Medium Impact)**
- Read JIRA_URL from environment
- Construct and store full browse URL
- Enables one-click navigation to Jira

**Priority 3: Enhance visibility (Low Impact)**
- Display Jira link in task view command
- Show sync state in task list
- Add --jira flag to filter Jira-linked tasks

### Implementation Strategy:

1. Start with pull.ts (most common user operation)
2. Add similar changes to push.ts and sync.ts
3. Test thoroughly with existing mapped tasks
4. Add integration tests
5. Update documentation
<!-- SECTION:NOTES:END -->
