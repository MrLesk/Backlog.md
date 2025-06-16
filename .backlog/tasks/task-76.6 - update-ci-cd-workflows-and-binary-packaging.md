---
id: task-76.6
title: Update CI/CD workflows and binary packaging
status: To Do
assignee: []
created_date: '2025-06-16'
labels:
  - ci-cd
  - deployment
  - infrastructure
dependencies: []
parent_task_id: task-76
---

## Description

Update CI/CD workflows and binary packaging processes to ensure they work correctly with the new neo-neo-blessed ESM-based implementation.

This involves:
- Updating GitHub Actions workflows
- Ensuring binary compilation works with ESM modules
- Verifying cross-platform binary generation
- Testing binary distribution and installation
- Updating any deployment scripts

## Acceptance Criteria

- [ ] Update GitHub Actions workflows to handle ESM builds
- [ ] Ensure binary compilation succeeds on all platforms (Windows, macOS, Linux)
- [ ] Verify generated binaries include neo-neo-blessed correctly
- [ ] Test binary size and ensure tree shaking is effective
- [ ] Update npm packaging scripts if needed
- [ ] Test installation via npm/bun on all platforms
- [ ] Verify standalone binaries work without node_modules
- [ ] Update release workflow to package new binaries
- [ ] Test auto-update mechanism with new binaries
- [ ] Document any changes to release process
- [ ] Ensure CI tests pass with neo-neo-blessed
