---
id: task-76.4
title: Update build system and remove CJS workarounds
status: Won't Do
assignee: []
created_date: '2025-06-16'
labels:
  - build
  - configuration
  - cleanup
dependencies: []
parent_task_id: task-76
---

## Description

Update the build system to fully leverage ESM modules and remove any CommonJS-specific workarounds that were required for the blessed library.

This includes:
- Updating build scripts to use ESM throughout
- Removing CJS compatibility layers or polyfills
- Optimizing bundler configuration for tree shaking
- Updating TypeScript configuration for ESM output
- Cleaning up any blessed-specific patches or scripts

## Acceptance Criteria

- [ ] Update bundler configuration to optimize for ESM and tree shaking
- [ ] Remove `patch-blessed.js` script if no longer needed
- [ ] Update TypeScript config to output pure ESM modules
- [ ] Remove any CJS polyfills or compatibility code
- [ ] Update build script in package.json for ESM compilation
- [ ] Ensure compiled binaries work correctly with ESM modules
- [ ] Verify bundle size reduction through tree shaking
- [ ] Update any import resolution configurations
- [ ] Clean up scripts/cli.cjs if using CJS workarounds
- [ ] Document build process changes

## Migration Cancellation Note

This task has been cancelled. After assessment (task 76.1), it was determined that neo-neo-blessed does not support ESM modules, which contradicts its main selling point. The migration to neo-neo-blessed has been abandoned in favor of continuing with the current blessed implementation.
