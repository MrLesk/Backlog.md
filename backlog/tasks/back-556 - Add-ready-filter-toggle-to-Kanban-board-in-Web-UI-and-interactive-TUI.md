---
id: BACK-556
title: Add ready filter toggle to Kanban board in Web UI and interactive TUI
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-24 08:21'
updated_date: '2026-07-24 08:36'
labels: []
dependencies: []
priority: medium
type: feature
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend Kanban filtering across Web UI and TUI to support filtering board tasks by readiness (getTaskReadiness.isReady). Add ready toggle button in Web Kanban header bar and hotkey/shared filter support in TUI.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
