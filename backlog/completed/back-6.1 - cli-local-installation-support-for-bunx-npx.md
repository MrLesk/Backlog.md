---
id: BACK-6.1
title: 'CLI: Local installation support for bunx/npx'
status: Done
assignee: []
reporter: @MrLesk
created_date: '2025-06-08'
updated_date: '2025-06-09'
labels:
  - cli
dependencies: []
parent_task_id: task-6
---

## Description

Allow installing Backlog.md locally in JS projects so agents can run bunx/npx backlog create when global install isn't available.

## Acceptance Criteria

- [x] Remove `"private": true` from package.json to allow publishing
- [x] Configure proper package name/scope for npm registry
- [x] Test and verify `npx backlog` and `bunx backlog` work from any project directory
- [x] Update documentation with local installation instructions

## Implementation Notes

**Package Configuration:**
- `package.json` configured for npm publishing with proper `name`, `version` (0.1.0), and `bin` entry
- `bin` field points to `./cli/index.js` enabling global CLI access after installation
- Build script creates both Node.js bundle and compiled binary for distribution flexibility

**Local Installation Support:**
- Package installable via `npm install backlog.md --save-dev` or `bun add -d backlog.md`
- CLI accessible through `npx backlog` and `bunx backlog` commands
- Works from any directory within the project after local installation

**Documentation:**
- `README.md` includes comprehensive local installation section (lines 15-30)
- Documents both npm and bun installation methods
- Provides clear usage examples for npx/bunx execution

**Test Coverage:**
- `local-install.test.ts` automatically tests both execution methods
- Creates temporary project, builds tarball, installs locally, and verifies CLI functionality
- Tests confirm `--help` output contains expected "Backlog project management CLI" text
- Both npx and bunx execution paths validated in isolated environment

The implementation ensures seamless local installation for projects where global CLI installation isn't available, particularly useful for AI agents working in constrained environments.
