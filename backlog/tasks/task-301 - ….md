---
id: task-301
title: …
status: Done
assignee: ["codex"]
created_date: '2025-10-14 13:48'
updated_date: '2025-10-14 13:50'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plugin commands like 'backlog jira' fail with 'unknown command' error because Commander validates commands before the plugin router gets a chance to intercept them.

## Problem
- Plugin routing check happens at lines 2990-3004 in cli.ts
- Commander is initialized at line 264 and configured with all commands
- When parseAsync() is called, Commander throws 'unknown command' error before plugin router can act
- This prevents plugins like backlog-jira from being invoked via 'backlog jira' syntax

## Root Cause
Race condition: Commander's synchronous command validation happens before the async plugin routing logic executes.

## Current Behavior
```bash
$ backlog jira --version
error: unknown command 'jira'
```

## Expected Behavior  
```bash
$ backlog jira --version
0.1.4  # Should delegate to backlog-jira plugin
```

## Proposed Solution
Move plugin routing check to happen BEFORE Commander is initialized, or configure Commander to delegate unknown commands to plugin router instead of erroring.

## Files Involved
- src/cli.ts (lines 264, 2990-3012)
- src/core/plugin-router.ts

## Implementation

### Changes Made

1. **Moved plugin routing check before Commander initialization** (src/cli.ts:188-201)
   - Added plugin routing logic immediately after version retrieval
   - Plugin routing now happens before Commander is ever initialized
   - If a plugin command is detected, the process exits before Commander.parseAsync() is called
   - This prevents Commander from validating commands and throwing "unknown command" errors

2. **Updated variable naming for clarity** (src/cli.ts:191-206)
   - Renamed `rawArgs` to `splashArgs` in the splash screen handling block to avoid confusion
   - Preserved original `rawArgs` for plugin routing logic

3. **Removed duplicate plugin routing code** (src/cli.ts:2990-3004)
   - Removed the old plugin routing check that was after Commander initialization
   - Simplified to just call `program.parseAsync()` since routing is handled earlier

4. **Added 'mcp' to core commands list** (src/core/plugin-router.ts:119)
   - Added "mcp" to the list of known core commands to prevent it from being routed to plugins

### Testing

Tested with:
```bash
# Test existing plugin (backlog-jira is installed)
$ ./dist/backlog jira --version
0.1.4  # Success! Plugin executed

# Test non-existent plugin
$ ./dist/backlog nonexistent-plugin --help
Error: Plugin 'backlog-nonexistent-plugin' not found.
To use this command, install the plugin:
  npm install -g backlog-nonexistent-plugin
  ...
# Shows helpful plugin not found message instead of "unknown command"

# Test core commands still work
$ ./dist/backlog --version
1.15.2  # Success!
```

### Result

✅ Plugin commands now work correctly - they are routed to plugins before Commander validates them
✅ Core commands continue to work as expected
✅ Unknown plugin commands show helpful installation instructions instead of confusing errors
<!-- SECTION:DESCRIPTION:END -->
