---
id: task-77
title: Migrate from blessed to bblessed for better Bun and Windows support
status: Done
assignee:
  - '@ai-agent'
created_date: '2025-06-16'
updated_date: '2025-06-16'
labels:
  - refactoring
  - dependencies
  - windows
dependencies: []
---

## Description

Successfully migrated from the original blessed library to bblessed (github:context-labs/bblessed), a Bun-optimized fork that eliminates the need for complex Windows patches and provides better cross-platform compatibility.

## Background

The project previously used blessed v0.1.81 with a custom patch script (`scripts/patch-blessed.js`) that:
1. Replaced dynamic widget loading with static imports for Bun bundling
2. Bundled terminfo files and patched tput.js for Windows compatibility

This patching was fragile and a maintenance burden.

## Acceptance Criteria

- [x] Replace blessed with bblessed in package.json
- [x] Remove postinstall patch script
- [x] Remove patch-blessed.js and terminfo resources
- [x] All tests pass with bblessed
- [x] Board view and other TUI components work correctly
- [x] Windows binary builds without patches
- [x] No regression in functionality

## Implementation Details

### Migration Steps Completed:
1. Installed bblessed from GitHub: `npm install github:context-labs/bblessed`
2. Removed postinstall script from package.json
3. Deleted `scripts/patch-blessed.js`
4. Deleted `resources/terminfo/` directory
5. All imports still use `import blessed from "blessed"` (no code changes needed)
6. Verified all tests pass (229/229)
7. Tested board view and other TUI functionality

### Key Benefits:
- **No more patches**: bblessed is designed for Bun, handles bundling correctly
- **Better Windows support**: Cross-platform compatibility built-in
- **Cleaner setup**: No postinstall scripts or resource files needed
- **Same API**: Drop-in replacement, no code changes required
- **Active maintenance**: bblessed is actively maintained for Bun compatibility

### Technical Notes:
- bblessed has debug logging controlled by `ENABLE_BLESSED_LOGGING` environment variable
- Set to `false` in production to disable verbose output
- The library is imported as `blessed` in package.json for compatibility

### Related Tasks Updated:
- Task 41: Updated to reflect actual bblessed usage
- Task 53: Added note about improved Bun compatibility
- Task 61: Added note about better bundling with bblessed
- Task 72: Added note about eliminating terminfo patches
- Task 74: Added note about better cross-platform support
- Tasks 76-76.6: Archived (neo-neo-blessed migration cancelled)
