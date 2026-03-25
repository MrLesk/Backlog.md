---
id: BACK-190
title: Fix Git errors and TypeScript compilation issues
status: Done
assignee:
  - '@claude'
created_date: '2025-07-14'
labels: []
dependencies: []
---

## Description

The command 'backlog list -s "to do"' was showing Git errors when trying to access non-existent remote branches. Additionally, running 'bunx tsc' revealed multiple TypeScript compilation errors that needed to be resolved.

## Acceptance Criteria

- [x] Git errors no longer appear when running task list commands
- [x] All critical TypeScript compilation errors are fixed
- [x] Code passes biome linting checks

## Implementation Notes

Fixed listRemoteBranches method to only return branches from specified remote instead of all remotes. Fixed TypeScript errors including: added missing filter properties (priority/sort), changed private getCompletedDir() to public completedDir getter, added non-null assertions for safe cases, removed deprecated backlogDirectory config property, fixed uninitialized variables and type mismatches. Remaining TypeScript errors are mostly in test files and not critical for production code.
