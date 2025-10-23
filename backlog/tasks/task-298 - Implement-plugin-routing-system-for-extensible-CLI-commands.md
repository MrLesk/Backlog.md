---
id: task-298
title: Implement plugin routing system for extensible CLI commands
status: Done
assignee:
  - '@codex'
created_date: '2025-10-13 11:24'
updated_date: '2025-10-13 11:28'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a minimal plugin router to the core Backlog CLI that discovers and routes subcommands to installed plugins (e.g., backlog-jira, backlog-github). This enables 'backlog <plugin> <command>' pattern without hardcoding plugin-specific code in core. Implementation follows the git plugin pattern (git-lfs style) where plugins are discovered via npm bin directory or PATH.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plugin router added to core CLI that intercepts unknown subcommands
- [x] #2 Router checks for 'backlog-<subcommand>' executables in node_modules/.bin and PATH
- [x] #3 Unknown commands are forwarded to plugins with remaining arguments
- [x] #4 Router provides helpful error message when plugin not found, suggesting installation
- [x] #5 Plugin forwarding preserves stdio (stdout, stderr, stdin) for interactive commands
- [x] #6 Plugin process exit codes are properly propagated to parent process
- [x] #7 Documentation added explaining plugin architecture and how to create plugins
- [x] #8 Zero coupling maintained - core has no knowledge of specific plugins
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Study existing CLI structure and Commander.js setup
2. Create plugin router module that discovers backlog-<name> executables
3. Implement command interception before Commander parsing
4. Add plugin execution with stdio forwarding and exit code propagation
5. Implement helpful error messages for missing plugins
6. Add documentation about plugin architecture
7. Test plugin discovery and execution
8. Verify zero coupling with specific plugins
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented plugin routing system following git plugin pattern (git-lfs style).

Changes:
- Created `src/core/plugin-router.ts` with PluginRouter class
- Router discovers plugins by searching for `backlog-<name>` executables in PATH
- Supports both Unix (which) and Windows (where) for executable discovery
- Intercepts unknown commands before Commander parsing
- Forwards stdio (stdin, stdout, stderr) to plugin process
- Properly propagates plugin exit codes to parent process
- Provides helpful error messages suggesting plugin installation
- Zero coupling - core has no knowledge of specific plugins

Documentation:
- Added comprehensive `docs/plugins.md` explaining:
  - How plugins work (discovery, routing, execution)
  - How to use plugins (installation, usage examples)
  - How to create plugins (requirements, example code)
  - Plugin best practices (structure, error handling, configuration)
  - Troubleshooting guide

Testing:
- Verified plugin routing correctly handles unknown commands
- Confirmed core commands still work (--version, task list, etc.)
- Tested error messages for missing plugins
- Build succeeds with no errors in core codebase

Architecture benefits:
- Plugins developed and published independently
- No version coupling between core and plugins
- Clean separation of concerns
- Follows established git plugin pattern
<!-- SECTION:NOTES:END -->
