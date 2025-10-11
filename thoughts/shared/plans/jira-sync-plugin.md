# Jira Bidirectional Sync Plugin Implementation Plan

**Date**: 2025-10-11T07:20:00Z  
**Original Plan**: thoughts/shared/plans/jira-sync-integration.md  
**Adaptation**: Plugin architecture with zero core changes  
**Repository**: Backlog.md (will create separate `backlog-jira` standalone CLI)

## Overview

Implement bidirectional synchronization between Jira tickets and local Backlog.md tasks as a **standalone plugin CLI** that uses only public APIs: MCP Atlassian server for Jira operations and the `backlog` CLI for all local file operations. This plugin architecture requires **zero changes** to the existing Backlog.md codebase.

## Current State Analysis

**Why Plugin Architecture is Required:**

From examining the Backlog.md codebase:
- No plugin system exists in `src/cli.ts` (commands are hardcoded in Commander setup)
- Parser/serializer in `src/markdown/` cannot extend frontmatter without core changes
- `Core` class in `src/core/backlog.ts` has no extension points for plugins
- FileSystem operations are internal with no public hooks
- Adding Jira fields to Task types would require changes to `src/types/index.ts`

**Constraints Discovered:**
- All task writes must go through `backlog task edit` CLI commands (never direct file writes)
- Plugin state must be separate from task files (no frontmatter pollution)
- MCP Atlassian is available via context7 MCP tools for Jira API access
- Cross-platform CLI invocation requires careful argument handling

**Key Architectural Decision:**
Create `backlog-jira` as a standalone CLI that orchestrates between two external systems:
1. **Jira** (via MCP Atlassian server)  
2. **Backlog.md** (via public `backlog` CLI)

## Desired End State

A production-ready plugin where:

1. **Users install and configure easily**: `npm i -g backlog-jira` → `backlog-jira init`
2. **Mapping is intuitive**: `backlog-jira map --auto` discovers and links tasks/issues
3. **Sync is robust**: `backlog-jira sync --all` handles conflicts gracefully with 3-way merge
4. **Status is visible**: `backlog-jira status` shows sync states and conflicts
5. **Integration is seamless**: Works with existing Backlog.md workflows without any core changes

### Verification Commands:
```bash
# Basic functionality
backlog-jira map --auto
backlog-jira push task-123
backlog-jira pull task-123  
backlog-jira sync --strategy prefer-backlog

# Status and monitoring
backlog-jira status --grep "Conflict"
backlog-jira watch --interval 60s

# Environment validation
backlog-jira doctor
```

## What We're NOT Doing

- **NOT modifying Backlog.md core** - Zero changes to `src/` directory
- **NOT adding frontmatter fields** - Plugin maintains separate mapping state  
- **NOT creating internal APIs** - Only public CLI and MCP interfaces
- **NOT real-time webhooks** - Pull-based sync with optional polling
- **NOT attachment sync** - Focus on core fields (title, description, status, labels, assignee, AC)
- **NOT Jira workflow automation** - Basic status transitions only
- **NOT embedding in Backlog.md** - Separate npm package and CLI binary

---

## Implementation Approach

### Strategy:
1. **Standalone CLI Plugin** - `backlog-jira` as separate npm package
2. **External State Management** - SQLite database in `.backlog-jira/` directory  
3. **Public API Only** - Backlog CLI for writes, MCP Atlassian for Jira
4. **3-Way Merge** - Store base snapshots for proper conflict detection
5. **Progressive Enhancement** - Core features first, advanced features later

### Key Design Principles:
- **Zero coupling**: Plugin failure cannot break Backlog.md  
- **Auditable state**: All operations logged with before/after snapshots
- **Conflict-aware**: Always detect and handle concurrent edits gracefully
- **CLI-driven**: Leverage existing `backlog task edit` commands for consistency
- **Cross-platform**: Support Windows, macOS, Linux with proper CLI argument handling

---

## Phase 1: Foundation & Scaffolding

### Overview
Create the basic plugin structure, configuration system, and connection verification.

### Changes Required:

#### 1. Project Structure
**Path**: `backlog-jira/` (new standalone repository/package)

```
backlog-jira/
├── package.json                 # Bun + TypeScript setup
├── biome.json                   # Tabs + double quotes (match Backlog.md)
├── src/
│   ├── cli.ts                   # Commander-based CLI router
│   ├── commands/
│   │   ├── init.ts             # Bootstrap .backlog-jira/
│   │   ├── connect.ts          # Verify MCP connectivity  
│   │   ├── doctor.ts           # Environment checks
│   │   └── config.ts           # Config management
│   ├── integrations/
│   │   ├── backlog.ts          # Backlog CLI wrapper
│   │   └── jira.ts             # MCP Atlassian wrapper
│   ├── state/
│   │   └── store.ts            # SQLite state management
│   └── utils/
│       ├── logger.ts           # Pino logger setup
│       └── validation.ts       # Input validation
├── test/                       # Unit and integration tests
└── .backlog-jira.sample/       # Sample configuration
```

#### 2. Package Configuration
**File**: `backlog-jira/package.json`

```json
{
  "name": "backlog-jira",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "backlog-jira": "dist/cli.js"
  },
  "scripts": {
    "build": "bun build --target=bun src/cli.ts --outdir=dist",
    "dev": "bun run src/cli.ts",
    "test": "bun test",
    "check": "biome check .",
    "check:types": "bunx tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0", 
    "pino": "^8.16.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.8.3",
    "@types/better-sqlite3": "^7.6.8",
    "typescript": "^5.2.2"
  }
}
```

#### 3. Core Configuration System
**File**: `backlog-jira/src/commands/init.ts`

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";

export async function initCommand() {
  const configDir = join(process.cwd(), ".backlog-jira");
  
  // Bootstrap directory structure
  await mkdir(join(configDir, "logs"), { recursive: true });
  
  // Create default configuration
  const config = {
    jira: {
      baseUrl: "",
      projectKey: "",
      issueType: "Task",
      jqlFilter: ""
    },
    backlog: {
      statusMapping: {
        "To Do": ["To Do", "Open", "Backlog"],
        "In Progress": ["In Progress"],
        "Done": ["Done", "Closed", "Resolved"]
      }
    },
    sync: {
      conflictStrategy: "prompt",
      enableAnnotations: false,
      watchInterval: 60
    }
  };
  
  await writeFile(
    join(configDir, "config.json"), 
    JSON.stringify(config, null, 2)
  );
  
  logger.info("Initialized .backlog-jira/ configuration");
}
```

#### 4. State Store Schema
**File**: `backlog-jira/src/state/store.ts`

```typescript
import Database from "better-sqlite3";
import { join } from "node:path";

export class SyncStore {
  private db: Database.Database;

  constructor() {
    const dbPath = join(process.cwd(), ".backlog-jira", "db.sqlite");
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      -- Task to Jira mapping
      CREATE TABLE IF NOT EXISTS mappings (
        backlog_id TEXT PRIMARY KEY,
        jira_key TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Snapshots for 3-way merge
      CREATE TABLE IF NOT EXISTS snapshots (
        backlog_id TEXT,
        side TEXT CHECK(side IN ('backlog', 'jira')),
        hash TEXT,
        payload TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(backlog_id, side)
      );

      -- Sync state tracking  
      CREATE TABLE IF NOT EXISTS sync_state (
        backlog_id TEXT PRIMARY KEY,
        last_sync_at TEXT,
        conflict_state TEXT,
        strategy TEXT
      );

      -- Operations audit log
      CREATE TABLE IF NOT EXISTS ops_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT DEFAULT CURRENT_TIMESTAMP,
        op TEXT,
        backlog_id TEXT,
        jira_key TEXT,
        outcome TEXT,
        details TEXT
      );
    `);
  }

  // CRUD methods for mappings, snapshots, sync state...
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bunx tsc --noEmit`
- [ ] Linting passes: `bun run check`  
- [ ] Package builds: `bun run build`
- [ ] CLI loads: `./dist/cli.js --help`

#### Manual Verification:
- [ ] `backlog-jira init` creates `.backlog-jira/` with config.json and db.sqlite
- [ ] `backlog-jira doctor` checks for Bun runtime, backlog CLI, MCP server availability
- [ ] Configuration can be read/written: `backlog-jira config get jira.projectKey`

---

## Phase 2: Backlog & Jira Integration Layer

### Overview  
Implement wrappers for Backlog CLI operations and MCP Atlassian client.

### Changes Required:

#### 1. Backlog CLI Wrapper
**File**: `backlog-jira/src/integrations/backlog.ts`

```typescript
import { spawn } from "node:child_process";
import { logger } from "../utils/logger.ts";

export class BacklogClient {
  
  async listTasks(): Promise<Task[]> {
    const output = await this.exec(["task", "list", "--plain"]);
    return this.parseTaskList(output);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const output = await this.exec(["task", taskId, "--plain"]);
    return this.parseTaskDetail(output);
  }

  async updateTask(taskId: string, updates: TaskUpdates): Promise<void> {
    const args = ["task", "edit", taskId];
    
    if (updates.title) args.push("-t", updates.title);
    if (updates.description) args.push("-d", updates.description);
    if (updates.status) args.push("-s", updates.status);
    if (updates.labels) args.push("-l", updates.labels.join(","));
    if (updates.assignee) args.push("-a", updates.assignee);
    
    await this.exec(args);
  }

  private async exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("backlog", args, { 
        shell: false,
        stdio: ["pipe", "pipe", "pipe"]
      });
      
      let stdout = "";
      let stderr = "";
      
      proc.stdout.on("data", (data) => stdout += data);
      proc.stderr.on("data", (data) => stderr += data);
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`backlog CLI error: ${stderr}`));
        }
      });
    });
  }

  private parseTaskList(output: string): Task[] {
    // Parse --plain output format
    // File: /path/to/task-123 - Title.md
    // Status: ○ To Do  
    // etc.
  }
}
```

#### 2. MCP Atlassian Wrapper
**File**: `backlog-jira/src/integrations/jira.ts`

```typescript
import { call_mcp_tool } from "@context7/mcp-client";
import { logger } from "../utils/logger.ts";

export class JiraClient {
  
  async searchIssues(jql: string): Promise<JiraIssue[]> {
    const result = await call_mcp_tool("jira_search", JSON.stringify({
      jql,
      fields: "summary,description,status,labels,assignee"
    }));
    
    return JSON.parse(result).issues;
  }

  async getIssue(issueKey: string): Promise<JiraIssue | null> {
    const result = await call_mcp_tool("jira_get_issue", JSON.stringify({
      issue_key: issueKey,
      fields: "summary,description,status,labels,assignee,transitions"
    }));
    
    return JSON.parse(result);
  }

  async updateIssue(issueKey: string, fields: JiraFields): Promise<void> {
    await call_mcp_tool("jira_update_issue", JSON.stringify({
      issue_key: issueKey,
      fields
    }));
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await call_mcp_tool("jira_transition_issue", JSON.stringify({
      issue_key: issueKey,
      transition_id: transitionId
    }));
  }
}
```

#### 3. Connection Verification
**File**: `backlog-jira/src/commands/connect.ts`

```typescript
import { BacklogClient } from "../integrations/backlog.ts";
import { JiraClient } from "../integrations/jira.ts";
import { logger } from "../utils/logger.ts";

export async function connectCommand() {
  logger.info("Verifying connections...");
  
  // Test Backlog CLI
  try {
    const backlog = new BacklogClient();
    const tasks = await backlog.listTasks();
    logger.info(`✓ Backlog CLI: Found ${tasks.length} tasks`);
  } catch (error) {
    logger.error("✗ Backlog CLI not available", error);
    process.exit(1);
  }

  // Test MCP Atlassian
  try {
    const jira = new JiraClient();
    const issues = await jira.searchIssues("project is not empty ORDER BY key LIMIT 1");
    logger.info(`✓ MCP Atlassian: Connected to Jira`);
  } catch (error) {
    logger.error("✗ MCP Atlassian not available", error);
    process.exit(1);
  }

  logger.info("All connections verified");
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bunx tsc --noEmit`
- [ ] Unit tests pass: `bun test src/integrations/`
- [ ] CLI argument parsing preserves multiline strings

#### Manual Verification:
- [ ] `backlog-jira connect` successfully verifies Backlog CLI and MCP connections
- [ ] Backlog wrapper can list tasks and parse task details
- [ ] Jira wrapper can search issues and get issue details
- [ ] Multiline descriptions round-trip correctly through Backlog CLI

---

## Phase 3: Mapping and Status Commands

### Overview
Implement discovery and mapping of Backlog tasks to Jira issues, plus status reporting.

### Changes Required:

#### 1. Auto-Mapping Logic
**File**: `backlog-jira/src/commands/map.ts`

```typescript
import { BacklogClient } from "../integrations/backlog.ts";
import { JiraClient } from "../integrations/jira.ts";
import { SyncStore } from "../state/store.ts";

export async function mapCommand(options: { auto: boolean; interactive: boolean }) {
  const backlog = new BacklogClient();
  const jira = new JiraClient();
  const store = new SyncStore();

  // Find unmapped tasks
  const tasks = await backlog.listTasks();
  const mapped = store.getAllMappings();
  const unmappedTasks = tasks.filter(t => !mapped.has(t.id));

  if (options.auto) {
    // Auto-match by title similarity
    const issues = await jira.searchIssues(getJQLFilter());
    
    for (const task of unmappedTasks) {
      const match = findBestMatch(task, issues);
      if (match && match.confidence > 0.8) {
        store.addMapping(task.id, match.issue.key);
        logger.info(`Mapped ${task.id} → ${match.issue.key} (${match.confidence})`);
      }
    }
  }

  if (options.interactive) {
    // Interactive mapping UI
    for (const task of unmappedTasks) {
      const candidates = await suggestCandidates(task, jira);
      const choice = await promptUserChoice(task, candidates);
      
      if (choice) {
        store.addMapping(task.id, choice.key);
      }
    }
  }
}

function findBestMatch(task: Task, issues: JiraIssue[]): { issue: JiraIssue; confidence: number } | null {
  // Title similarity using Levenshtein distance or fuzzy matching
  // Return best match above confidence threshold
}
```

#### 2. Status Command
**File**: `backlog-jira/src/commands/status.ts`

```typescript
export async function statusCommand(options: { json?: boolean; grep?: string }) {
  const backlog = new BacklogClient();
  const jira = new JiraClient();
  const store = new SyncStore();

  const mappings = store.getAllMappings();
  const statusRows: StatusRow[] = [];

  for (const [backlogId, jiraKey] of mappings) {
    const task = await backlog.getTask(backlogId);
    const issue = await jira.getIssue(jiraKey);
    
    if (!task || !issue) continue;

    const backlogHash = computeHash(normalizeBacklogPayload(task));
    const jiraHash = computeHash(normalizeJiraPayload(issue));
    
    const lastSnapshots = store.getSnapshots(backlogId);
    const syncState = classifySyncState(
      backlogHash, jiraHash, 
      lastSnapshots.backlog?.hash, 
      lastSnapshots.jira?.hash
    );

    statusRows.push({
      backlogId,
      jiraKey,
      localChanged: syncState.localChanged,
      remoteChanged: syncState.remoteChanged,
      conflict: syncState.conflict,
      lastSync: lastSnapshots.backlog?.updated_at
    });
  }

  if (options.grep) {
    statusRows = statusRows.filter(row => 
      matchesPattern(row, options.grep!)
    );
  }

  if (options.json) {
    console.log(JSON.stringify({ 
      summary: computeSummary(statusRows),
      rows: statusRows 
    }));
  } else {
    printStatusTable(statusRows);
  }
}

function classifySyncState(currentBacklog: string, currentJira: string, lastBacklog?: string, lastJira?: string) {
  const localChanged = lastBacklog && currentBacklog !== lastBacklog;
  const remoteChanged = lastJira && currentJira !== lastJira;
  const conflict = localChanged && remoteChanged && currentBacklog !== currentJira;
  
  return { localChanged, remoteChanged, conflict };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bunx tsc --noEmit`  
- [ ] Unit tests pass: `bun test src/commands/map.ts src/commands/status.ts`
- [ ] Auto-mapping accuracy > 80% on test dataset

#### Manual Verification:
- [ ] `backlog-jira map --auto` discovers and maps obvious title matches
- [ ] `backlog-jira map --interactive` provides user-friendly selection UI
- [ ] `backlog-jira status` shows correct sync states (InSync, NeedsPush, NeedsPull, Conflict)
- [ ] `backlog-jira status --grep "Conflict"` filters to conflicted items only
- [ ] `backlog-jira status --json` produces valid JSON for scripting

---

## Phase 4: Push, Pull & Sync Commands

### Overview
Implement one-way and bidirectional sync with 3-way merge and conflict resolution.

### Changes Required:

#### 1. Push Command (Backlog → Jira)
**File**: `backlog-jira/src/commands/push.ts`

```typescript
export async function pushCommand(taskId?: string, options: { all?: boolean }) {
  const backlog = new BacklogClient();
  const jira = new JiraClient();
  const store = new SyncStore();

  const taskIds = taskId ? [taskId] : options.all ? getAllMappedTaskIds() : [];

  for (const id of taskIds) {
    const mapping = store.getMapping(id);
    if (!mapping) continue;

    const task = await backlog.getTask(id);
    const issue = await jira.getIssue(mapping.jiraKey);
    
    if (!task) continue;

    const updates = computeJiraUpdates(task, issue);
    
    if (Object.keys(updates.fields).length > 0) {
      await jira.updateIssue(mapping.jiraKey, updates.fields);
    }
    
    if (updates.transition) {
      await jira.transitionIssue(mapping.jiraKey, updates.transition);
    }

    // Update snapshots
    store.setSnapshot(id, 'backlog', computeHash(normalizeBacklogPayload(task)), task);
    store.setSnapshot(id, 'jira', computeHash(normalizeJiraPayload(issue)), issue);
    store.updateSyncState(id, { last_sync_at: new Date().toISOString() });

    logger.info(`Pushed ${id} → ${mapping.jiraKey}`);
  }
}

function computeJiraUpdates(task: Task, issue?: JiraIssue): { fields: JiraFields; transition?: string } {
  const updates: JiraFields = {};
  
  if (task.title !== issue?.fields.summary) {
    updates.summary = task.title;
  }
  
  if (task.description !== issue?.fields.description) {
    updates.description = convertMarkdownToJira(task.description);
  }
  
  // Add acceptance criteria to description  
  if (task.acceptanceCriteria?.length > 0) {
    updates.description += "\n\n## Acceptance Criteria\n";
    for (const ac of task.acceptanceCriteria) {
      const checkbox = ac.checked ? "[x]" : "[ ]";
      updates.description += `- ${checkbox} ${ac.text}\n`;
    }
  }

  const transition = computeStatusTransition(task.status, issue?.fields.status);
  
  return { fields: updates, transition };
}
```

#### 2. Pull Command (Jira → Backlog)
**File**: `backlog-jira/src/commands/pull.ts`

```typescript
export async function pullCommand(taskId?: string, options: { all?: boolean }) {
  const backlog = new BacklogClient();
  const jira = new JiraClient();
  const store = new SyncStore();

  const taskIds = taskId ? [taskId] : options.all ? getAllMappedTaskIds() : [];

  for (const id of taskIds) {
    const mapping = store.getMapping(id);
    if (!mapping) continue;

    const task = await backlog.getTask(id);
    const issue = await jira.getIssue(mapping.jiraKey);
    
    if (!task || !issue) continue;

    const updates = computeBacklogUpdates(issue, task);
    
    if (updates.length > 0) {
      for (const update of updates) {
        await backlog.updateTask(id, update);
      }
    }

    // Update snapshots
    store.setSnapshot(id, 'backlog', computeHash(normalizeBacklogPayload(task)), task);
    store.setSnapshot(id, 'jira', computeHash(normalizeJiraPayload(issue)), issue);
    store.updateSyncState(id, { last_sync_at: new Date().toISOString() });

    logger.info(`Pulled ${mapping.jiraKey} → ${id}`);
  }
}
```

#### 3. Bidirectional Sync with 3-Way Merge
**File**: `backlog-jira/src/commands/sync.ts`

```typescript
export async function syncCommand(taskId?: string, options: { 
  all?: boolean; 
  strategy?: "prefer-backlog" | "prefer-jira" | "prompt" 
}) {
  const store = new SyncStore();
  const taskIds = taskId ? [taskId] : options.all ? getAllMappedTaskIds() : [];

  for (const id of taskIds) {
    await syncSingleTask(id, options.strategy || "prompt");
  }
}

async function syncSingleTask(taskId: string, strategy: string) {
  const backlog = new BacklogClient();
  const jira = new JiraClient();
  const store = new SyncStore();

  const mapping = store.getMapping(taskId);
  if (!mapping) return;

  const task = await backlog.getTask(taskId);
  const issue = await jira.getIssue(mapping.jiraKey);
  const snapshots = store.getSnapshots(taskId);

  if (!task || !issue) return;

  const currentBacklog = normalizeBacklogPayload(task);
  const currentJira = normalizeJiraPayload(issue);
  const baseBacklog = snapshots.backlog ? JSON.parse(snapshots.backlog.payload) : null;
  const baseJira = snapshots.jira ? JSON.parse(snapshots.jira.payload) : null;

  // Perform 3-way merge
  const mergeResult = performThreeWayMerge(
    currentBacklog, currentJira,
    baseBacklog, baseJira
  );

  if (mergeResult.conflicts.length === 0) {
    // No conflicts - apply changes
    await applyMergeResult(taskId, mergeResult);
    logger.info(`Synced ${taskId} without conflicts`);
  } else {
    // Handle conflicts based on strategy
    const resolution = await resolveConflicts(mergeResult.conflicts, strategy);
    await applyConflictResolution(taskId, resolution);
    logger.info(`Synced ${taskId} with ${mergeResult.conflicts.length} conflicts resolved`);
  }
}

function performThreeWayMerge(currentBacklog: any, currentJira: any, baseBacklog: any, baseJira: any) {
  const conflicts: FieldConflict[] = [];
  const resolved: ResolvedField[] = [];

  for (const field of ["title", "description", "status", "labels", "assignee"]) {
    const backlogValue = currentBacklog[field];
    const jiraValue = currentJira[field];
    const backlogBase = baseBacklog?.[field];
    const jiraBase = baseJira?.[field];

    const backlogChanged = backlogValue !== backlogBase;
    const jiraChanged = jiraValue !== jiraBase;

    if (!backlogChanged && !jiraChanged) {
      // No changes
      continue;
    } else if (backlogChanged && !jiraChanged) {
      // Only Backlog changed
      resolved.push({ field, value: backlogValue, direction: "backlog-to-jira" });
    } else if (!backlogChanged && jiraChanged) {
      // Only Jira changed  
      resolved.push({ field, value: jiraValue, direction: "jira-to-backlog" });
    } else if (backlogValue === jiraValue) {
      // Both changed to same value
      resolved.push({ field, value: backlogValue, direction: "both" });
    } else {
      // Conflict - both changed to different values
      conflicts.push({
        field,
        backlogValue,
        jiraValue, 
        backlogBase,
        jiraBase
      });
    }
  }

  return { resolved, conflicts };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bunx tsc --noEmit`
- [ ] Unit tests pass: `bun test src/commands/`
- [ ] 3-way merge algorithm handles all conflict scenarios correctly
- [ ] CLI invocations preserve multiline content

#### Manual Verification:
- [ ] `backlog-jira push task-123` updates Jira with Backlog changes
- [ ] `backlog-jira pull task-123` updates Backlog with Jira changes (via CLI only)
- [ ] `backlog-jira sync task-123 --strategy prefer-backlog` resolves conflicts to Backlog side
- [ ] Concurrent edits on both sides trigger conflict detection and resolution
- [ ] Acceptance criteria sync properly in both directions

---

## Phase 5: Watch Mode & Advanced Features  

### Overview
Add polling-based auto-sync, doctor command, and optional task annotations.

### Changes Required:

#### 1. Watch Command
**File**: `backlog-jira/src/commands/watch.ts`

```typescript
export async function watchCommand(options: { interval: string }) {
  const intervalMs = parseInterval(options.interval); // e.g., "60s" → 60000
  
  logger.info(`Starting watch mode (interval: ${options.interval})`);
  
  let lastCheck = new Date();
  
  while (true) {
    try {
      await performIncrementalSync(lastCheck);
      lastCheck = new Date();
    } catch (error) {
      logger.error("Watch sync failed", error);
    }
    
    await sleep(intervalMs);
  }
}

async function performIncrementalSync(since: Date) {
  const jira = new JiraClient();
  const store = new SyncStore();

  // Find Jira issues updated since last check
  const updatedIssues = await jira.searchIssues(
    `project = ${getProjectKey()} AND updated >= "${since.toISOString()}"`
  );

  for (const issue of updatedIssues) {
    const mapping = store.getMappingByJiraKey(issue.key);
    if (mapping) {
      logger.info(`Detected remote change in ${issue.key}, syncing...`);
      await syncSingleTask(mapping.backlogId, "prefer-backlog");
    }
  }

  // Check for local Backlog changes by comparing hashes
  const mappings = store.getAllMappings();
  
  for (const [backlogId] of mappings) {
    const task = await new BacklogClient().getTask(backlogId);
    if (!task) continue;

    const currentHash = computeHash(normalizeBacklogPayload(task));
    const lastSnapshot = store.getSnapshot(backlogId, 'backlog');
    
    if (!lastSnapshot || currentHash !== lastSnapshot.hash) {
      logger.info(`Detected local change in ${backlogId}, syncing...`);
      await syncSingleTask(backlogId, "prefer-backlog");
    }
  }
}
```

#### 2. Doctor Command
**File**: `backlog-jira/src/commands/doctor.ts`

```typescript
export async function doctorCommand() {
  const checks = [
    checkBunRuntime,
    checkBacklogCLI,
    checkMCPConnection,
    checkDatabasePerms,
    checkGitStatus
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      await check();
      logger.info(`✓ ${check.name}`);
    } catch (error) {
      logger.error(`✗ ${check.name}: ${error.message}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    process.exit(1);
  }
  
  logger.info("All checks passed");
}

async function checkBunRuntime() {
  const version = await exec("bun --version");
  if (!version.startsWith("1.")) {
    throw new Error("Bun 1.x required");
  }
}

async function checkBacklogCLI() {
  await exec("backlog --version");
}

async function checkMCPConnection() {
  const jira = new JiraClient();
  await jira.searchIssues("project is not empty LIMIT 1");
}

async function checkDatabasePerms() {
  const store = new SyncStore();
  store.testWriteAccess();
}

async function checkGitStatus() {
  const status = await exec("git status --porcelain");
  if (status.trim()) {
    logger.warn("Working directory has uncommitted changes");
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `bunx tsc --noEmit`
- [ ] All tests pass: `bun test | grep -Ei "pass|fail|error|success|summary"`
- [ ] Build succeeds: `bun run build`
- [ ] No linting errors: `bun run check | grep -Ei "error|warning"`

#### Manual Verification:  
- [ ] `backlog-jira watch --interval 30s` detects and syncs changes automatically
- [ ] `backlog-jira doctor` validates complete environment setup
- [ ] Watch mode handles rate limits and network errors gracefully
- [ ] All commands work across Windows, macOS, and Linux

---

## Testing Strategy

### Unit Tests:
- Payload normalization and hashing functions
- 3-way merge algorithm with all conflict scenarios  
- Status classification logic
- CLI argument assembly and parsing

### Integration Tests:
- Mock MCP server responses for Jira operations
- Mock Backlog CLI subprocess calls
- End-to-end mapping and sync workflows
- Cross-platform CLI invocation (especially Windows)

### Test Commands:
```bash
# Full test suite with summary
bun test | grep -Ei "pass|fail|error|success|summary"

# Type checking  
bunx tsc --noEmit | grep -Ei "error|fail"

# Linting
bun run check | grep -Ei "error|warning"

# Focused testing
bun test test/sync.spec.ts | grep -Ei "pass|fail|error|success"
```

### CI Pipeline:
- Matrix: ubuntu-latest, windows-latest, macos-latest
- Steps: install, typecheck, lint, test, build
- Always grep test output for pass/fail summary
- Cache bun install cache and node_modules

---

## Performance Considerations

- **Incremental sync**: Only process changed items in watch mode
- **Concurrent operations**: Batch MCP calls where possible (rate limit aware)
- **SQLite optimization**: Use transactions for bulk operations
- **CLI overhead**: Cache task lists and minimize subprocess calls
- **Memory usage**: Stream large result sets instead of loading all in memory

---

## Security & Configuration

- **No credentials stored**: MCP Atlassian server handles all auth
- **State isolation**: `.backlog-jira/` added to `.gitignore`
- **Log redaction**: Scrub any auth-like strings from logs
- **Permission model**: Read-only access to task files, write via CLI only

---

## Documentation Plan

### README.md:
1. **Prerequisites**: Bun, Backlog.md CLI, MCP Atlassian server setup
2. **Installation**: `npm install -g backlog-jira` 
3. **Quickstart**: init → connect → map → sync workflow
4. **Command reference**: All commands with examples
5. **Configuration**: Status mapping, JQL filters, conflict strategies
6. **Troubleshooting**: Common issues and solutions

### Advanced Topics:
- Custom status mappings for different Jira workflows
- User mapping between Backlog @handles and Jira accountIds
- Conflict resolution strategies and interactive prompts
- Watch mode deployment and monitoring

---

## Success Criteria

### Automated (CI must pass):
- [ ] `bunx tsc --noEmit` produces no errors
- [ ] `bun run check` produces no errors/warnings
- [ ] `bun test | grep -Ei "pass|fail|error|success|summary"` shows only pass/success
- [ ] Cross-platform builds succeed on Linux/macOS/Windows
- [ ] Multiline argument handling works on Windows

### Manual (Acceptance testing):
- [ ] **Installation**: `npm i -g backlog-jira` → `backlog-jira --help` works
- [ ] **Setup**: `backlog-jira init` → `backlog-jira connect` → `backlog-jira doctor` all pass
- [ ] **Mapping**: Auto-map discovers obvious matches, interactive allows fine-tuning
- [ ] **Push**: Local task changes update Jira correctly (summary, description, status, labels, AC)
- [ ] **Pull**: Jira changes update Backlog tasks via CLI (no direct file writes)
- [ ] **Sync**: Concurrent edits trigger conflict detection, resolution strategies work
- [ ] **Status**: Accurate state classification, grep filtering, JSON output
- [ ] **Watch**: Detects remote changes within interval, syncs automatically
- [ ] **Integration**: Works with existing Backlog.md workflows, no core changes needed

### Performance Targets:
- [ ] Sync 100 mapped tasks in < 30 seconds
- [ ] Watch mode interval as low as 10 seconds without hitting rate limits
- [ ] Memory usage < 100MB for typical workloads

---

## References

- Original integrated plan: `thoughts/shared/plans/jira-sync-integration.md`
- Task-287: `backlog/tasks/task-287 - Jira-Bidirectional-Sync-Integration.md`
- Backlog.md source analysis: Zero plugin system found in core
- MCP Atlassian: context7 MCP server with jira_* tools
- CLI argument patterns: Windows requires careful newline handling

---

## Timeline

- **Week 1**: Phase 1 (Foundation) + Phase 2 (Integration layers)  
- **Week 2**: Phase 3 (Mapping, Status) + Phase 4 (Push/Pull/Sync)
- **Week 3**: Phase 5 (Watch, Doctor) + Testing + Documentation
- **Week 4**: Cross-platform hardening, performance optimization, user feedback

**Total estimated effort**: 3-4 weeks for production-ready plugin

---

## File Layout Checklist

- [ ] `backlog-jira/package.json` (Bun + TypeScript setup)
- [ ] `backlog-jira/src/cli.ts` (Commander-based router)
- [ ] `backlog-jira/src/commands/init.ts` (Bootstrap config)
- [ ] `backlog-jira/src/commands/connect.ts` (Connection verification)
- [ ] `backlog-jira/src/commands/map.ts` (Auto/interactive mapping)
- [ ] `backlog-jira/src/commands/status.ts` (Sync state reporting) 
- [ ] `backlog-jira/src/commands/push.ts` (Backlog → Jira)
- [ ] `backlog-jira/src/commands/pull.ts` (Jira → Backlog)
- [ ] `backlog-jira/src/commands/sync.ts` (3-way merge)
- [ ] `backlog-jira/src/commands/watch.ts` (Polling sync)
- [ ] `backlog-jira/src/commands/doctor.ts` (Environment checks)
- [ ] `backlog-jira/src/integrations/backlog.ts` (CLI wrapper)
- [ ] `backlog-jira/src/integrations/jira.ts` (MCP client wrapper)
- [ ] `backlog-jira/src/state/store.ts` (SQLite state management)
- [ ] `backlog-jira/src/utils/logger.ts` (Pino logging)
- [ ] `backlog-jira/test/` (Unit and integration tests)
- [ ] `backlog-jira/README.md` (User documentation)

This plan provides a complete roadmap for implementing Jira sync as a standalone plugin with zero changes to the Backlog.md core, maintaining full compatibility and extensibility.