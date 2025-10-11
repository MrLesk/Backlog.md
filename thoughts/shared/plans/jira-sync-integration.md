# Jira Bidirectional Sync Implementation Plan

**Date**: 2025-10-11T04:50:00Z  
**Git Commit**: 843edfdc8efbe83328c330518e2a1b7d86d58800  
**Branch**: main  
**Repository**: Backlog.md

## Overview

Implement bidirectional synchronization between Jira tickets and local markdown files in Backlog.md, using the MCP Atlassian server for all Jira API interactions. Users can import Jira issues, sync changes bidirectionally, and resolve conflicts when both systems are modified.

## Current State Analysis

**Backlog.md Architecture:**
- Task persistence: Markdown files in `backlog/tasks/` with YAML frontmatter
- ID pattern: `task-{number}` (e.g., `task-123 - Feature Name.md`)
- Core modules: `Core`, `FileSystem`, `GitOperations`, `ContentStore`, `BacklogServer`
- CLI: Commander-based with subcommands (`task`, `board`, `doc`, etc.)
- Web UI: React with REST API endpoints
- File watching: `ContentStore` monitors file changes

**Key Discoveries:**
- No existing Jira integration (grep confirmed)
- Uses `@Slf4j` logging preference (avoid `println`)
- Has `autoCommit` config for git operations
- Cross-branch task tracking already implemented
- Markdown parser/serializer uses `gray-matter` for frontmatter

**MCP Atlassian Integration:**
- Available via `call_mcp_tool` function
- Handles all authentication (API tokens, OAuth2)
- Provides tools: `jira_search`, `jira_get_issue`, `jira_update_issue`, `jira_transition_issue`, `jira_add_comment`, `jira_get_comments`, etc.
- No auth logic needed in Backlog.md codebase

## Desired End State

A fully functional Jira sync feature where:

1. **Users can import Jira issues** via JQL queries
2. **Local changes push to Jira** (status, comments, fields)
3. **Remote changes pull from Jira** with conflict detection
4. **Conflicts are resolved** interactively with smart merge
5. **Auto-check triggers** after 5+ minutes of inactivity on edited files
6. **Web UI shows sync status** with action buttons
7. **All operations are tracked** in sync state database

### Verification:
- Run `backlog jira import --project PROJ` → creates markdown files
- Edit file locally, run `backlog jira push PROJ-123` → updates Jira
- Edit same issue in Jira, run `backlog jira pull PROJ-123` → detects conflict
- Resolve conflict → both systems synchronized
- Web UI displays sync badges and status

## What We're NOT Doing

- **NOT replacing markdown as primary storage** - markdown remains source of truth for local work
- **NOT real-time sync via webhooks** - manual or on-demand only (with optional auto-check)
- **NOT syncing attachments** - future enhancement
- **NOT handling Jira workflows beyond basic transitions** - user chooses transition if ambiguous
- **NOT migrating all historical Jira data** - selective import only

---

## Implementation Approach

### Strategy:
1. **MCP-first architecture** - All Jira API calls via MCP Atlassian server
2. **State tracking via SQLite** - Track sync state, conflicts, and base snapshots for 3-way merge
3. **Incremental phases** - Import → Pull → Push → Sync → Auto-check → Web UI
4. **Conservative conflict resolution** - Always prompt user, never auto-overwrite without confirmation

### Key Design Decisions:
- Use Jira issue keys (e.g., `PROJ-123`) as task IDs in Backlog.md
- Store sync metadata in frontmatter (last sync time, remote updated time, sync state)
- Preserve user notes in markdown that aren't synced to Jira
- Use HTML comments as markers for Jira-managed sections (`<!-- jira:description:start -->`)

---

## Phase 1: Foundation & Configuration

### Overview
Set up core infrastructure: configuration schema, MCP client wrapper, sync state database, and logging.

### Changes Required:

#### 1. Configuration Schema
**File**: `src/types/index.ts`  
**Changes**: Add Jira config types

```typescript
export interface JiraConfig {
  enabled: boolean;
  projectKeys: string[];
  fieldMappings: {
    status: string;
    assignee: string;
    labels: string;
    priority: string;
    storyPoints?: string;
    [key: string]: string | undefined;
  };
  sync: {
    autoCheckOnLocalEdit: boolean;
    autoCheckMinInterval: string; // e.g., "5m"
    concurrency: number;
    dryRun: boolean;
  };
}

export interface BacklogConfig {
  // ... existing fields
  jira?: JiraConfig;
}
```

**File**: `src/file-system/operations.ts`  
**Changes**: Update config parser to handle `jira` section with validation

#### 2. MCP Jira Client Wrapper
**File**: `src/integrations/jira/MCPJiraClient.ts` (new)  
**Changes**: Create type-safe wrapper around MCP tools

```typescript
import { call_mcp_tool } from '../mcp';

export class MCPJiraClient {
  async searchIssues(jql: string, limit = 50, startAt = 0) {
    return await call_mcp_tool('jira_search', JSON.stringify({
      jql, limit, start_at: startAt,
      fields: 'summary,status,assignee,labels,priority,description,updated,created'
    }));
  }

  async getIssue(issueKey: string) {
    return await call_mcp_tool('jira_get_issue', JSON.stringify({
      issue_key: issueKey,
      fields: 'summary,status,assignee,labels,priority,description,updated,created,comment'
    }));
  }

  // ... more methods wrapping MCP tools
}
```

#### 3. Sync State Database
**File**: `src/integrations/jira/SyncStore.ts` (new)  
**Changes**: SQLite database for tracking sync state

```typescript
import Database from 'better-sqlite3';

export class SyncStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        jira_key TEXT PRIMARY KEY,
        local_path TEXT NOT NULL,
        last_sync_at TEXT,
        remote_updated_at TEXT,
        local_hash TEXT,
        base_snapshot_json TEXT,
        conflict_state TEXT,
        last_error TEXT,
        last_pushed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS comments (
        jira_key TEXT NOT NULL,
        comment_id TEXT NOT NULL,
        last_seen_updated_at TEXT,
        PRIMARY KEY (jira_key, comment_id)
      );
    `);
  }

  // CRUD methods for sync state...
}
```

#### 4. Structured Logging
**File**: `src/utils/logger.ts` (new)  
**Changes**: Pino-based logger with secret redaction

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['*.token', '*.apiToken', '*.password', '*.secret'],
    censor: '[REDACTED]'
  }
});

export default logger;
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bunx tsc --noEmit`
- [ ] Config validation works: Unit test for parsing jira config
- [ ] Database initializes: Test SyncStore constructor creates tables
- [ ] MCP client instantiates: Unit test verifies wrapper methods exist

#### Manual Verification:
- [ ] Add `jira` section to `backlog/config.yml` and verify it loads
- [ ] Create SyncStore instance and verify `.backlog/jira-sync.db` is created
- [ ] Logger redacts secrets when logging config

---

## Phase 2: CLI Setup & Import Command

### Overview
Implement `backlog jira setup` for configuration and `backlog jira import` for importing issues from Jira.

### Changes Required:

#### 1. CLI Setup Command
**File**: `src/cli.ts`  
**Changes**: Add jira command group

```typescript
const jiraCmd = program.command('jira').description('Jira integration commands');

jiraCmd
  .command('setup')
  .description('Configure Jira integration')
  .action(async () => {
    const { runJiraSetup } = await import('./cli/commands/jira-setup.ts');
    await runJiraSetup(process.cwd());
  });
```

**File**: `src/cli/commands/jira-setup.ts` (new)  
**Changes**: Interactive setup wizard

```typescript
import prompts from 'prompts';
import { Core } from '../../core/backlog.ts';
import { MCPJiraClient } from '../../integrations/jira/MCPJiraClient.ts';
import logger from '../../utils/logger.ts';

export async function runJiraSetup(cwd: string) {
  const core = new Core(cwd);
  const client = new MCPJiraClient();
  
  // Test MCP connection
  try {
    await client.searchIssues('project is not empty', 1);
    logger.info('✓ MCP Atlassian connection verified');
  } catch (error) {
    console.error('✗ Cannot connect to Jira via MCP');
    console.error('Please ensure mcp-atlassian server is configured.');
    process.exit(1);
  }

  // Prompt for configuration
  const answers = await prompts([
    {
      type: 'list',
      name: 'projectKeys',
      message: 'Enter Jira project keys to sync (comma-separated):',
      initial: ''
    },
    {
      type: 'confirm',
      name: 'autoCheck',
      message: 'Enable auto-check on file edits (>5 min)?',
      initial: true
    }
  ]);

  // Save to config
  const config = await core.filesystem.loadConfig();
  config.jira = {
    enabled: true,
    projectKeys: answers.projectKeys.split(',').map(k => k.trim()),
    fieldMappings: { /* defaults */ },
    sync: {
      autoCheckOnLocalEdit: answers.autoCheck,
      autoCheckMinInterval: '5m',
      concurrency: 4,
      dryRun: false
    }
  };
  await core.filesystem.saveConfig(config);
  
  console.log('✓ Jira sync configured successfully');
}
```

#### 2. Import Command & Mapping Service
**File**: `src/cli/commands/jira-import.ts` (new)  
**File**: `src/integrations/jira/JiraMappingService.ts` (new)  

**Changes**: Implement JQL-based import with markdown conversion

### Success Criteria:

#### Automated Verification:
- [ ] `bunx tsc --noEmit` passes
- [ ] `backlog jira setup --help` shows options
- [ ] Unit test: JiraMappingService converts Jira issue to Task object

#### Manual Verification:
- [ ] Run `backlog jira setup` and complete wizard
- [ ] Run `backlog jira import --project PROJ --limit 5`
- [ ] Verify 5 markdown files created in `backlog/tasks/` with Jira keys as IDs
- [ ] Open a file and verify frontmatter has `jira_key`, `jira_last_sync`, etc.
- [ ] Verify sync store has entries for imported issues

---

## Phase 3: Pull & Push Commands

### Overview
Implement `backlog jira pull` to fetch remote changes and `backlog jira push` to send local changes to Jira.

### Changes Required:

#### 1. Pull Command
**File**: `src/cli/commands/jira-pull.ts` (new)  
**Changes**: Fetch issue, detect changes, handle conflicts

#### 2. Push Command  
**File**: `src/cli/commands/jira-push.ts` (new)  
**Changes**: Compute delta, update Jira via MCP, handle transitions

#### 3. Conflict Resolver
**File**: `src/integrations/jira/JiraConflictResolver.ts` (new)  
**Changes**: 3-way merge logic with interactive resolution

```typescript
import diff3 from 'node-diff3';
import { createPatch } from 'diff';

export class JiraConflictResolver {
  resolve3Way(base: string, local: string, remote: string) {
    const result = diff3.merge(local, base, remote);
    
    if (result.conflict) {
      // Interactive resolution needed
      return {
        hasConflict: true,
        merged: null,
        conflicts: result.conflict
      };
    }
    
    return {
      hasConflict: false,
      merged: result.result.join('\n')
    };
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `bunx tsc --noEmit` passes
- [ ] Unit tests for conflict detection logic pass
- [ ] Mock MCP calls in integration tests

#### Manual Verification:
- [ ] Import issue PROJ-123
- [ ] Edit description locally
- [ ] Run `backlog jira push PROJ-123`
- [ ] Verify change appears in Jira UI
- [ ] Edit same issue in Jira (different field)
- [ ] Run `backlog jira pull PROJ-123`
- [ ] Verify fast-forward merge (no conflict)
- [ ] Edit both locally and remotely (same field)
- [ ] Run `backlog jira pull PROJ-123`
- [ ] Verify conflict detection and interactive resolution prompt

---

## Phase 4: Sync Command & Status Display

### Overview
Implement batch sync for all linked tasks and status command to show sync state.

### Changes Required:

#### 1. Sync Command
**File**: `src/cli/commands/jira-sync.ts` (new)  
**Changes**: Batch sync with concurrency control

#### 2. Status Command
**File**: `src/cli/commands/jira-status.ts` (new)  
**Changes**: Display sync state table

```typescript
export async function runJiraStatus(core: Core) {
  const store = new SyncStore(/* path */);
  const states = store.getAllIssueStates();
  
  console.table(states.map(s => ({
    'Jira Key': s.jira_key,
    'Status': s.conflict_state || 'clean',
    'Last Sync': s.last_sync_at || 'never',
    'Remote Updated': s.remote_updated_at
  })));
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `bunx tsc --noEmit` passes
- [ ] Unit test for sync logic with mock issues

#### Manual Verification:
- [ ] Import 3 issues
- [ ] Edit one locally, one remotely, one in both places
- [ ] Run `backlog jira status` → see 3 rows with correct states
- [ ] Run `backlog jira sync --changed` → syncs only changed tasks
- [ ] Verify conflicts are resolved and clean tasks updated

---

## Phase 5: Auto-Check & Web UI Integration

### Overview
Add automatic remote checking on local edits (5-minute guard) and web UI components for sync status.

### Changes Required:

#### 1. Auto-Check in ContentStore
**File**: `src/core/content-store.ts`  
**Changes**: Hook into file watcher to trigger checks

#### 2. Server API Routes
**File**: `src/server/routes/jira.ts` (new)  
**Changes**: Add REST endpoints

```typescript
// GET /api/jira/status
// POST /api/jira/sync/:id
// POST /api/jira/pull/:id
// POST /api/jira/push/:id
```

#### 3. Web UI Components
**File**: `src/web/components/JiraBadge.tsx` (new)  
**File**: `src/web/components/JiraConflictModal.tsx` (new)  
**Changes**: React components for sync UI

### Success Criteria:

#### Automated Verification:
- [ ] `bunx tsc --noEmit` passes
- [ ] `bun run check` (lint/format) passes
- [ ] API endpoints respond with 200
- [ ] React components render without errors

#### Manual Verification:
- [ ] Edit a Jira-linked task file
- [ ] Wait 6 minutes
- [ ] Verify auto-check triggered (check logs or sync store)
- [ ] Open web UI (`backlog browser`)
- [ ] Verify Jira badge shows on linked tasks
- [ ] Click "Pull" button → updates task
- [ ] Edit task in web UI, click "Push" → updates Jira

---

## Testing Strategy

### Unit Tests:
- JiraMappingService: Jira issue → Task conversion, Task → Jira payload
- JiraConflictResolver: 3-way merge scenarios
- SyncStore: CRUD operations on sync state
- Field mapping logic with custom fields

### Integration Tests:
- Mock MCP client responses with fixtures
- End-to-end: import → edit → push → pull flow
- Conflict scenarios: both sides changed, deleted issues

### Manual Testing Steps:
1. Configure Jira sync for a real project
2. Import 10 issues with various field values
3. Make local changes (status, description, labels)
4. Push changes and verify in Jira UI
5. Make conflicting changes in Jira
6. Pull and resolve conflicts
7. Run full sync and verify all tasks are clean
8. Test auto-check by editing and waiting

### Test Output:
Pipe tests through grep to reduce noise:
```bash
bun test --silent | grep -E "PASS|FAIL|ERROR|Success|Failure"
```

---

## Performance Considerations

- **Pagination**: Import uses JQL with `startAt`/`maxResults` for large result sets
- **Concurrency**: Sync command limits parallel MCP calls (default: 4)
- **Caching**: Cache Jira users and field metadata for session
- **Debouncing**: Auto-check debounces per file (5-minute minimum)
- **Incremental updates**: Only sync changed tasks, not all linked tasks

---

## Migration Notes

### Existing Tasks:
- Use `backlog jira link` command to link existing `task-N` files to Jira issues
- Renames file to `PROJ-123.md` format
- Initializes sync state with current Jira snapshot

### Data Safety:
- Always store base snapshot for 3-way merge
- Git integration: auto-commit changes (configurable)
- Dry-run mode available: `--dry-run` flag

---

## References

- MCP Atlassian tools: https://github.com/mrchecker/mcp-atlassian
- Original request: User wants bidirectional Jira sync with conflict resolution
- Backlog.md codebase: `/Users/eciuca/workspace/eciuca/Backlog.md`
- Git commit: `843edfdc8efbe83328c330518e2a1b7d86d58800`

---

## File Layout Checklist

- [ ] `src/integrations/jira/MCPJiraClient.ts`
- [ ] `src/integrations/jira/JiraConfig.ts`
- [ ] `src/integrations/jira/JiraMappingService.ts`
- [ ] `src/integrations/jira/JiraConflictResolver.ts`
- [ ] `src/integrations/jira/SyncStore.ts`
- [ ] `src/integrations/jira/JiraMarkdown.ts`
- [ ] `src/cli/commands/jira-setup.ts`
- [ ] `src/cli/commands/jira-import.ts`
- [ ] `src/cli/commands/jira-pull.ts`
- [ ] `src/cli/commands/jira-push.ts`
- [ ] `src/cli/commands/jira-sync.ts`
- [ ] `src/cli/commands/jira-status.ts`
- [ ] `src/cli/commands/jira-link.ts`
- [ ] `src/server/routes/jira.ts`
- [ ] `src/web/components/JiraBadge.tsx`
- [ ] `src/web/components/JiraConflictModal.tsx`
- [ ] `src/utils/logger.ts`
- [ ] `docs/jira-sync.md`

---

## Timeline

- **Week 1**: Phase 1 (Foundation) + Phase 2 (Setup & Import)
- **Week 2**: Phase 3 (Pull & Push) + initial testing
- **Week 3**: Phase 4 (Sync & Status) + Phase 5 (Auto-check & Web UI)
- **Week 4**: Polish, documentation, comprehensive testing

**Total estimated effort**: 3-4 weeks for full implementation with testing.
