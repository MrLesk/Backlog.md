---
id: BACK-550
title: Add append-plan option to task edit CLI
status: To Do
assignee:
  - '@codex'
created_date: '2026-07-17 06:45'
labels:
  - cli
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/792'
  - 'https://github.com/MrLesk/Backlog.md/pull/793'
type: enhancement
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add repeatable `--append-plan` support to the canonical `backlog task edit` command so humans and agents can extend an implementation plan without replacing existing content or opening an editor, closing the current parity gap with MCP planAppend while preserving existing edit behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `backlog task edit --append-plan <text>` is a public repeatable option
- [ ] #2 Multiple append values are applied in CLI order, with each addition separated from existing or previously appended plan text by exactly one blank line
- [ ] #3 Each append preserves internal newlines and whitespace-only values are ignored, consistent with the shared plan append pipeline
- [ ] #4 The first nonblank append creates the plan section when the task has no implementation plan
- [ ] #5 When `--plan` and `--append-plan` are used together, `--plan` replaces the plan first and append values are then applied in CLI order
- [ ] #6 Real CLI tests cover noninteractive and PTY no-editor behavior, including a missing plan and combined replacement plus append
- [ ] #7 `backlog task edit --help` and the canonical task-execution guidance document `--append-plan` and its ordering relative to `--plan`
- [ ] #8 Existing `--plan`, `--append-notes`, MCP planAppend, and unrelated task edit fields retain their current behavior
- [ ] #9 The full test suite, `bunx tsc --noEmit`, `bun run check .`, and `bun run build` pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
