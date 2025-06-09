---
id: task-6.1
title: 'CLI: Local installation support for bunx/npx'
status: "To Do"
created_date: 2025-06-08
labels: [cli]
dependencies: []
parent_task_id: task-6
---

## Description

Allow installing Backlog.md locally in JS projects so agents can run bunx/npx backlog create when global install isn't available.

## Acceptance Criteria

- [ ] Remove `"private": true` from package.json to allow publishing
- [ ] Configure proper package name/scope for npm registry
- [ ] Test and verify `npx backlog` and `bunx backlog` work from any project directory
- [ ] Update documentation with local installation instructions
