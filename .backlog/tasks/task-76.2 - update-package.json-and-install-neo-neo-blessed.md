---
id: task-76.2
title: Update package.json and install neo-neo-blessed
status: Won't Do
assignee: []
created_date: '2025-06-16'
labels:
  - dependencies
  - configuration
dependencies: []
parent_task_id: task-76
---

## Description

Update the project dependencies to replace blessed with neo-neo-blessed and ensure proper installation and configuration.

This task involves:
- Removing the blessed dependency from package.json
- Adding neo-neo-blessed as a dependency
- Updating any related dev dependencies if needed
- Ensuring the package-lock/bun.lockb is updated
- Verifying the installation works correctly

## Acceptance Criteria

- [ ] Remove `blessed` from package.json dependencies
- [ ] Add `neo-neo-blessed` to package.json with appropriate version
- [ ] Run `bun install` and ensure it completes successfully
- [ ] Verify neo-neo-blessed is properly installed in node_modules
- [ ] Update any type definitions if neo-neo-blessed provides its own
- [ ] Ensure no peer dependency conflicts exist
- [ ] Commit updated package.json and lock file
- [ ] Document the version of neo-neo-blessed being used

## Migration Cancellation Note

This task has been cancelled. After assessment (task 76.1), it was determined that neo-neo-blessed does not support ESM modules, which contradicts its main selling point. The migration to neo-neo-blessed has been abandoned in favor of continuing with the current blessed implementation.
