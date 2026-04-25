---
id: BACK-431
title: Avoid Claude-rejected shell forms in agent guidance
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 12:14'
labels:
  - agent-guidelines
  - cli
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/595'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #595: generated agent guidance should avoid command examples that Claude Code rejects as ansi_c_string or unsafe shell forms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agent-facing instructions avoid ANSI-C string, heredoc, command substitution, and similarly rejected shell forms where possible.
- [ ] #2 Long multiline fields have a documented safe alternative for common agents.
- [ ] #3 Guideline snapshots/tests are updated to cover the safer examples.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
