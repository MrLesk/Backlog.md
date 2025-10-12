# backlog-jira

Bidirectional sync plugin between Backlog.md and Jira via MCP Atlassian server.

## Status: Phase 4 Complete ✓

Push, pull, and sync commands completed:
- ✅ Project structure with TypeScript + Bun
- ✅ Configuration system
- ✅ SQLite state store with schema
- ✅ Pino logger with secret redaction
- ✅ Init, connect, and doctor commands
- ✅ Backlog & Jira integration layer
- ✅ Mapping & status commands
- ✅ Push command (Backlog → Jira)
- ✅ Pull command (Jira → Backlog)
- ✅ Sync command with 3-way merge
- ✅ Conflict detection and resolution strategies
- ✅ TypeScript compilation passes
- ✅ Linting passes (Biome)

## Development Status

### Phase 1: Foundation & Scaffolding ✅ COMPLETE
- [x] Project structure
- [x] Configuration system
- [x] SQLite state store
- [x] Logger with secret redaction
- [x] Init command
- [x] Doctor command
- [x] Connect command (placeholder)
- [x] TypeScript compiles
- [x] Linting passes

### Phase 2: Backlog & Jira Integration Layer ✅ COMPLETE
- [x] Backlog CLI wrapper
- [x] MCP Atlassian client wrapper
- [x] Full connect command implementation

### Phase 3: Mapping & Status Commands ✅ COMPLETE
- [x] Auto-mapping logic
- [x] Interactive mapping
- [x] Status reporting

### Phase 4: Push, Pull & Sync Commands ✅ COMPLETE
- [x] Push (Backlog → Jira)
- [x] Pull (Jira → Backlog)
- [x] Bidirectional sync with 3-way merge
- [x] Conflict detection (field-level)
- [x] Conflict resolution strategies (prefer-backlog, prefer-jira, prompt, manual)
- [x] Snapshot management for 3-way merge

### Phase 5: Watch Mode & Advanced Features
- [ ] Watch command
- [ ] Advanced conflict resolution

## Prerequisites

- Bun 1.x (or Node.js 20+ for development)
- Backlog.md CLI installed
- MCP Atlassian server configured

## Installation (Future)

```bash
npm install -g backlog-jira
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run check:types

# Lint
npm run check

# Run CLI in dev mode (requires Bun)
bun run src/cli.ts --help
```

## Current Commands

### `backlog-jira init`
Initialize `.backlog-jira/` configuration directory with:
- `config.json` - Configuration file
- `jira-sync.db` - SQLite database
- `logs/` - Log directory

### `backlog-jira doctor`
Run environment health checks:
- Bun runtime version
- Backlog CLI availability
- Configuration file
- Database permissions
- Backlog.md project detection
- Git status

### `backlog-jira connect`
Verify connections to Backlog CLI and MCP Atlassian

### `backlog-jira map`
Create and manage task-to-issue mappings

### `backlog-jira status`
View sync status and recent operations

### `backlog-jira push [taskIds...]`
Push Backlog changes to Jira
- `--all` - Push all mapped tasks
- `--force` - Force push even if conflicts detected
- `--dry-run` - Show what would be pushed without making changes

### `backlog-jira pull [taskIds...]`
Pull Jira changes to Backlog
- `--all` - Pull all mapped tasks
- `--force` - Force pull even if conflicts detected
- `--dry-run` - Show what would be pulled without making changes

### `backlog-jira sync [taskIds...]`
Bidirectional sync with conflict resolution
- `--all` - Sync all mapped tasks
- `--strategy <strategy>` - Conflict resolution strategy: prefer-backlog|prefer-jira|prompt|manual
- `--dry-run` - Show what would be synced without making changes

## Architecture

- **Standalone CLI**: Separate npm package, zero changes to Backlog.md core
- **Public APIs only**: Backlog CLI for writes, MCP Atlassian for Jira
- **External state**: SQLite database in `.backlog-jira/` directory
- **3-way merge**: Store base snapshots for conflict detection

## Database Schema

### Tables
- `mappings` - Task to Jira issue mappings
- `snapshots` - Payload snapshots for 3-way merge (backlog & jira sides)
- `sync_state` - Sync tracking per task
- `ops_log` - Operations audit log

## Configuration

Example `.backlog-jira/config.json`:

```json
{
  "jira": {
    "baseUrl": "",
    "projectKey": "",
    "issueType": "Task",
    "jqlFilter": ""
  },
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Open", "Backlog"],
      "In Progress": ["In Progress"],
      "Done": ["Done", "Closed", "Resolved"]
    }
  },
  "sync": {
    "conflictStrategy": "prompt",
    "enableAnnotations": false,
    "watchInterval": 60
  }
}
```

## License

MIT (inherits from Backlog.md)
