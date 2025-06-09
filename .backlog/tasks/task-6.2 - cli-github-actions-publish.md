---
id: task-6.2
title: 'CLI: GitHub Actions for Build & Publish'
status: "To Do"
assignee: []
reporter: @MrLesk
created_date: '2025-06-09'
labels:
  - ci
dependencies: []
parent_task_id: task-6
---

## Description

Set up continuous integration for the CLI. Use GitHub Actions to build the project with Bun, run tests, and publish the package to npm (and by extension Yarn) when a release tag is pushed.

## Acceptance Criteria

- [ ] Workflow builds the CLI with `bun build` and runs tests
- [ ] Publishing step deploys to npm using `NODE_AUTH_TOKEN`
- [ ] Trigger on version tags like `v*.*.*`
- [ ] Documentation updated with release instructions
