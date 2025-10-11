# backlog-jira

Bidirectional sync plugin between Backlog.md and Jira via MCP Atlassian server.

## Status: Phase 1 Complete ✓

Foundation and scaffolding completed:
- ✅ Project structure with TypeScript + Bun
- ✅ Configuration system
- ✅ SQLite state store with schema
- ✅ Pino logger with secret redaction
- ✅ Init, connect, and doctor commands
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

### Phase 2: Backlog & Jira Integration Layer (Next)
- [ ] Backlog CLI wrapper
- [ ] MCP Atlassian client wrapper
- [ ] Full connect command implementation

### Phase 3: Mapping & Status Commands
- [ ] Auto-mapping logic
- [ ] Interactive mapping
- [ ] Status reporting

### Phase 4: Push, Pull & Sync Commands
- [ ] Push (Backlog → Jira)
- [ ] Pull (Jira → Backlog)
- [ ] Bidirectional sync with 3-way merge

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
Verify connections (placeholder - full implementation in Phase 2)

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
