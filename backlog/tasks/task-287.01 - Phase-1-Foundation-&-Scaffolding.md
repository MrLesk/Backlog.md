---
id: task-287.01
title: 'Phase 1: Foundation & Scaffolding'
status: To Do
assignee: []
created_date: '2025-10-11 05:02'
updated_date: '2025-10-11 07:44'
labels:
  - jira
  - foundation
  - phase1
dependencies: []
parent_task_id: task-287
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the basic plugin structure as a standalone npm package (backlog-jira) with configuration system and connection verification.

**Deliverables:**
- Project structure: package.json, biome.json, src/ directories
- Configuration system with .backlog-jira/ directory
- SQLite state store with schema for mappings, snapshots, sync state
- Pino logger setup with secret redaction
- Init, connect, and doctor commands
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 jira section in backlog/config.yml loads correctly
- [ ] #2 SyncStore instance creates .backlog/jira-sync.db file
- [ ] #3 Logger redacts secrets when logging config

- [ ] #4 TypeScript compiles: bunx tsc --noEmit
- [ ] #5 Linting passes: bun run check
- [ ] #6 Package builds: bun run build
- [ ] #7 CLI loads: ./dist/cli.js --help
- [ ] #8 backlog-jira init creates .backlog-jira/ with config.json and db.sqlite
- [ ] #9 backlog-jira doctor checks Bun, backlog CLI, MCP server availability
<!-- AC:END -->
