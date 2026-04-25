---
id: BACK-432
title: Parse definition_of_done with standard YAML semantics
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - config
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/599'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #599: config loading misparses definition_of_done values containing commas or empty block sequence entries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Quoted commas in flow-style definition_of_done entries are preserved as part of one checklist item.
- [ ] #2 Block-style definition_of_done sequences parse consistently, including empty or blank-line-adjacent lists.
- [ ] #3 CLI, MCP, and Web settings use the same config parse behavior.
- [ ] #4 Regression tests cover the issue's repro config examples.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
