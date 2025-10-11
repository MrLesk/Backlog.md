---
id: task-287
title: Jira Bidirectional Sync Integration
status: To Do
assignee: []
created_date: '2025-10-11 05:02'
updated_date: '2025-10-11 07:44'
labels:
  - jira
  - integration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement bidirectional synchronization between Jira tickets and local Backlog.md tasks as a **standalone plugin CLI** that uses only public APIs: MCP Atlassian server for Jira operations and the backlog CLI for all local file operations. This plugin architecture requires **zero changes** to the existing Backlog.md codebase.

Key architectural decision: Create backlog-jira as a standalone CLI that orchestrates between Jira (via MCP Atlassian) and Backlog.md (via public backlog CLI).

The plugin maintains its own state in .backlog-jira/ and never directly modifies task files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can import Jira issues via JQL queries
- [ ] #2 Local changes push to Jira (status, comments, fields)
- [ ] #3 Remote changes pull from Jira with conflict detection
- [ ] #4 Conflicts are resolved interactively with smart merge
- [ ] #5 All operations are tracked in sync state database

- [ ] #6 Plugin CLI (backlog-jira) can be installed and configured
- [ ] #7 Zero changes to Backlog.md core codebase
- [ ] #8 Watch mode detects and syncs changes automatically
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Detailed implementation plan available at:
`thoughts/shared/plans/jira-sync-plugin.md`

## Architecture

- **Standalone CLI**: backlog-jira as separate npm package
- **Zero core changes**: No modifications to Backlog.md codebase
- **Public APIs only**: Backlog CLI for writes, MCP Atlassian for Jira
- **External state**: SQLite database in .backlog-jira/ directory
- **3-way merge**: Store base snapshots for conflict detection

## Subtasks

This epic is broken down into 5 phases:
- task-287.01: Phase 1 - Foundation & Scaffolding
- task-287.02: Phase 2 - Backlog & Jira Integration Layer
- task-287.03: Phase 3 - Mapping & Status Commands
- task-287.04: Phase 4 - Push, Pull & Sync Commands
- task-287.05: Phase 5 - Watch Mode & Advanced Features

## Timeline

Estimated 3-4 weeks for production-ready plugin.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Plan

Detailed implementation plan available at:
`thoughts/shared/plans/jira-sync-integration.md`

## Subtasks

This epic is broken down into 5 phases:
- task-287.01: Phase 1 - Foundation & Configuration
- task-287.02: Phase 2 - CLI Setup & Import
- task-287.03: Phase 3 - Pull & Push Commands
- task-287.04: Phase 4 - Sync & Status Display
- task-287.05: Phase 5 - Auto-Check & Web UI

## Timeline

Estimated 3-4 weeks for full implementation with testing.
<!-- SECTION:NOTES:END -->
