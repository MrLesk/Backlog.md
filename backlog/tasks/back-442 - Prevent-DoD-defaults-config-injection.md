---
id: BACK-442
title: Prevent DoD defaults config injection
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 22:31'
labels:
  - security
  - mcp
  - definition-of-done
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/pull/555'
  - BACK-394
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Harden the MCP Definition of Done defaults upsert tool so unsafe user-provided default items cannot inject additional config keys or command-bearing values when persisted to project config. This task tracks PR #555 and is a focused security follow-up to the DoD default management work in BACK-394.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `definition_of_done_defaults_upsert` rejects unsafe default items that contain line breaks or quote characters before writing config.
- [ ] #2 Rejected unsafe upsert attempts leave the existing project Definition of Done defaults unchanged.
- [ ] #3 Existing valid Definition of Done default item behavior remains unchanged, including current delimiter validation.
- [ ] #4 Regression tests cover newline and quote payloads that could otherwise corrupt config or inject keys such as `onStatusChange`.
- [ ] #5 Type checking and the focused MCP Definition of Done defaults test suite pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
