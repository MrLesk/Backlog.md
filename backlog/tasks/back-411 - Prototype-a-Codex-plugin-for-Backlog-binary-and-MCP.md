---
id: BACK-411
title: Prototype a Codex plugin for Backlog binary and MCP
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-03 05:57'
labels: []
dependencies: []
documentation:
  - README.md
  - DEVELOPMENT.md
  - /Users/alex/.codex/skills/.system/plugin-creator/SKILL.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create an initial Codex plugin that makes Backlog easy to install and use inside Codex without manual MCP setup. The result should demonstrate a clear path for packaging the shipped Backlog executable model inside a plugin while preserving Backlog's MCP-first workflow and public CLI surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A valid Codex plugin prototype exists with the required manifest and companion files.
- [ ] #2 The prototype documents or encodes how Backlog binaries are obtained per platform in a way consistent with the npm release model.
- [ ] #3 The prototype provides a Codex-friendly MCP entry point for running backlog mcp start, including a project-root resolution strategy.
- [ ] #4 Local install and testing instructions are included so the plugin can be exercised from a Backlog-enabled project.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
