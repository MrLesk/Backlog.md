# Feature Request: Jira Bidirectional Sync Integration

## 🎯 Problem Statement

Development teams using Backlog.md need to collaborate with stakeholders and team members who exclusively use Jira. Currently, there's no way to synchronize work between these two systems, forcing developers to either:

1. Manually duplicate work between Backlog.md and Jira
2. Abandon Backlog.md and use only Jira
3. Work in isolation from the rest of the team

This creates friction for teams who want to leverage Backlog.md's developer-friendly workflow while maintaining integration with their organization's Jira instance.

## 💡 Proposed Solution

Implement a **bidirectional synchronization plugin** between Jira and Backlog.md that allows developers to work seamlessly in their preferred environment while staying in sync with team members using Jira.

### Key Design Principles

1. **Non-invasive Architecture**: Standalone CLI plugin (`backlog-jira`) that requires **zero changes** to Backlog.md core
2. **Public APIs Only**: Uses the Backlog.md CLI for local operations and MCP Atlassian server for Jira operations
3. **Developer-First**: Backlog.md remains the source of truth for local work; sync is explicit and controlled
4. **Conflict-Aware**: Smart 3-way merge with interactive conflict resolution
5. **Flexible**: Works with existing Backlog.md installations without requiring migration

## 🎨 User Experience

### Initial Setup (One-time)

```bash
# Install the plugin
npm install -g @backlog.md/jira-plugin

# Configure Jira connection
backlog-jira config set jira.url https://company.atlassian.net
backlog-jira config set jira.email user@company.com
backlog-jira config set jira.token <api-token>

# Set up project mapping
backlog-jira map project PROJ "My Project"
```

### Daily Workflow

```bash
# Import Jira issues to work on locally
backlog-jira import "project = PROJ AND assignee = currentUser()"

# Work locally using standard Backlog.md commands
backlog task edit 42 -s "In Progress"
backlog task edit 42 --check-ac 1

# Push local changes to Jira
backlog-jira push 42

# Pull updates from Jira (with conflict detection)
backlog-jira pull 42

# Or sync bidirectionally
backlog-jira sync 42

# Enable automatic syncing
backlog-jira watch
```

## 🔧 Core Features

### 1. Import from Jira

- Import issues via JQL queries
- Convert Jira issues to Backlog.md tasks with proper mapping
- Preserve Jira metadata (issue key, URL, custom fields)
- Support for epics, stories, subtasks, and issue links

### 2. Push to Jira

- Sync local task changes to Jira
- Update status, assignee, labels, description
- Add comments and worklogs
- Check and update custom fields

### 3. Pull from Jira

- Fetch remote changes from Jira
- Detect conflicts between local and remote changes
- Interactive conflict resolution with 3-way merge
- Preserve local work while incorporating remote updates

### 4. Bidirectional Sync

- Combine push and pull operations
- Smart merge with conflict detection
- Maintain sync state in local SQLite database
- Track last sync timestamps and change vectors

### 5. Watch Mode

- Continuously monitor for changes
- Auto-sync on file system changes
- Poll Jira for remote updates
- Configurable sync intervals

### 6. Status & Diagnostics

- View sync status for all linked tasks
- Display conflicts and sync errors
- Show mapping configuration
- Health checks for Jira connection

## 🏗️ Technical Architecture

### Plugin Structure

```
backlog-jira/                    # Standalone CLI plugin
├── src/
│   ├── commands/               # CLI commands (import, push, pull, sync, watch)
│   ├── jira/                   # Jira API client (via MCP Atlassian)
│   ├── backlog/                # Backlog.md CLI wrapper
│   ├── sync/                   # Sync engine & conflict resolution
│   ├── mapping/                # Field & status mapping
│   └── state/                  # SQLite state management
└── .backlog-jira/              # Plugin state directory
    ├── config.json             # Configuration
    ├── mappings.json           # Field & status mappings
    └── sync.db                 # SQLite sync state database
```

### Sync State Database

```sql
-- Track sync status for each task
CREATE TABLE task_sync (
  task_id TEXT PRIMARY KEY,
  jira_key TEXT NOT NULL,
  last_sync_at TEXT,
  local_hash TEXT,
  remote_hash TEXT,
  base_snapshot TEXT,      -- For 3-way merge
  conflict_status TEXT,     -- null, pending, resolved
  sync_direction TEXT       -- import, push, pull, bidirectional
);

-- Track field mappings
CREATE TABLE field_mappings (
  backlog_field TEXT PRIMARY KEY,
  jira_field TEXT NOT NULL,
  transform_fn TEXT         -- Optional transformation function
);

-- Sync history for debugging
CREATE TABLE sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT,
  operation TEXT,           -- import, push, pull, sync
  timestamp TEXT,
  success BOOLEAN,
  details TEXT
);
```

### Integration Points

1. **Backlog.md Integration** (Public API Only)
   - Uses `backlog` CLI for all task operations
   - Never directly modifies task files
   - Reads task data via CLI output

2. **Jira Integration** (MCP Atlassian Server)
   - Uses MCP tools for all Jira operations
   - Supports both Cloud and Server/Data Center
   - Handles authentication and rate limiting

3. **Conflict Resolution**
   - 3-way merge using base snapshots
   - Interactive prompts for conflicts
   - Configurable merge strategies (local-wins, remote-wins, manual)

## 📋 Use Cases

### Use Case 1: Developer Working on Jira-Tracked Sprint

**Scenario**: Dev wants to use Backlog.md for local task management but needs to sync with team's Jira sprint.

```bash
# Import sprint issues
backlog-jira import "sprint = 42 AND assignee = currentUser()"

# Work locally
backlog task edit 287 -s "In Progress"
backlog task edit 287 --check-ac 1
backlog task edit 287 --notes "Implemented OAuth flow"

# Sync back to Jira
backlog-jira sync 287
```

**Result**: Local work appears in Jira, team sees updates, developer stays in Backlog.md.

### Use Case 2: PM Updates Jira, Developer Pulls Changes

**Scenario**: PM changes priority and adds comments in Jira while dev is working locally.

```bash
# Developer checks for updates
backlog-jira pull 287

# Conflict detected: Local notes vs remote comments
# Interactive prompt:
# 
# Conflict in task-287:
# - Local: Changed implementation notes
# - Remote: PM added review comments
# 
# Options:
# 1. Keep local changes
# 2. Accept remote changes
# 3. Merge both (manual edit)
# 
# Choice: 3

# Opens editor to merge changes
# Saves merged result to both local and Jira
```

**Result**: Developer sees PM's input, merges it with local work, everyone stays in sync.

### Use Case 3: Team Collaboration with Mixed Tools

**Scenario**: 3 devs use Backlog.md, 2 use Jira directly, PM uses Jira.

```bash
# Each Backlog.md dev enables watch mode
backlog-jira watch

# Auto-syncs:
# - Local task changes → Jira (visible to all)
# - Jira updates → Local (visible in Backlog.md)
# - Conflicts → Interactive prompts
```

**Result**: Seamless collaboration regardless of tool preference.

## 🎯 Success Metrics

1. **Zero Core Changes**: Plugin installs and works without modifying Backlog.md codebase
2. **Reliability**: >95% successful sync rate without data loss
3. **Conflict Resolution**: <5% of syncs require manual intervention
4. **Performance**: Sync operations complete in <2 seconds per task
5. **Adoption**: 50%+ of Jira-using teams adopt Backlog.md with plugin

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Plugin CLI scaffolding
- [ ] Configuration management
- [ ] SQLite state database
- [ ] Jira connection via MCP
- [ ] Backlog CLI wrapper

### Phase 2: Core Sync (Week 2)
- [ ] Import command (JQL → Backlog.md)
- [ ] Push command (Local → Jira)
- [ ] Pull command (Jira → Local)
- [ ] Basic conflict detection

### Phase 3: Mapping & Conflicts (Week 3)
- [ ] Field mapping configuration
- [ ] Status mapping
- [ ] 3-way merge implementation
- [ ] Interactive conflict resolution

### Phase 4: Polish & Watch (Week 4)
- [ ] Sync command (bidirectional)
- [ ] Watch mode
- [ ] Status display
- [ ] Documentation & tests

## 🔍 Technical Considerations

### Challenges

1. **Conflict Resolution**: Need robust 3-way merge for complex scenarios
2. **Field Mapping**: Jira and Backlog.md have different field models
3. **Real-time Sync**: Watch mode needs efficient change detection
4. **Custom Fields**: Jira's custom fields require flexible mapping
5. **Performance**: Bulk operations need batching and caching

### Solutions

1. Use Git-style 3-way merge with base snapshots
2. Configurable field mapping with transformation functions
3. File system watchers + Jira webhooks/polling
4. Dynamic field discovery and user-defined mappings
5. Batch operations with local caching

## 📦 Deliverables

1. **npm Package**: `@backlog.md/jira-plugin`
2. **Documentation**: Setup guide, workflow examples, troubleshooting
3. **Test Suite**: Unit tests, integration tests, E2E tests
4. **Migration Guide**: For teams adopting the plugin
5. **Video Tutorial**: 5-minute demo of core workflows

## 🤝 Community Impact

This feature enables:

- **Enterprise Adoption**: Companies using Jira can adopt Backlog.md without abandoning existing tools
- **Team Flexibility**: Developers choose their preferred tool while maintaining team cohesion
- **Process Integration**: Backlog.md integrates into existing Jira-based workflows
- **Ecosystem Growth**: Opens door for other integrations (GitHub Projects, Linear, etc.)

## 📝 Open Questions

1. Should the plugin support one-way sync only (simpler) or bidirectional (more complex)?
   - **Proposal**: Start with bidirectional, add one-way mode as optional config

2. How should we handle Jira features not present in Backlog.md (e.g., sprints, boards)?
   - **Proposal**: Store in task metadata/labels, add optional support in future

3. Should we support importing Jira attachments?
   - **Proposal**: Phase 2 feature, download to task directory

4. How to handle large imports (100+ issues)?
   - **Proposal**: Batch processing with progress indicators

5. Should the plugin be part of Backlog.md core or separate repo?
   - **Proposal**: Separate repo initially, consider merging if widely adopted

## 🎬 Next Steps

1. Gather community feedback on this proposal
2. Create detailed technical design document
3. Build MVP with import + push commands
4. Beta test with 3-5 teams using Jira
5. Iterate based on feedback
6. Release v1.0 with full bidirectional sync

---

**Related Issue**: task-287 in Backlog.md project  
**Champion**: @eciuca  
**Target Release**: Q2 2025
