---
id: task-6.2
title: 'CLI: GitHub Actions for Build & Publish'
status: Done
assignee: []
reporter: '@MrLesk'
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels:
  - ci
dependencies: []
parent_task_id: task-6
---
## Description

Set up continuous integration for the CLI. Use GitHub Actions to build the project with Bun, run tests, and publish the package to npm (and by extension Yarn) when a release tag is pushed.

## Acceptance Criteria

- [x] Workflow builds the CLI with `bun build` and runs tests
- [x] Publishing step deploys to npm using `NODE_AUTH_TOKEN`
- [x] Trigger on version tags like `v*.*.*`
- [x] Documentation updated with release instructions

## Implementation Notes
- Added `.github/workflows/ci.yml` to build with `bun`, run tests and publish to npm on version tags.
- Workflow uses `oven-sh/setup-bun` and publishes when `github.ref` starts with `refs/tags/` using `NODE_AUTH_TOKEN`.
- README now includes a Release section describing how to tag a new version to trigger the workflow.
