---
id: BACK-431
title: Avoid Claude-rejected shell forms in agent guidance
status: Done
assignee:
  - '@codex'
created_date: '2026-04-25 12:14'
updated_date: '2026-05-02 15:53'
labels:
  - agent-guidelines
  - cli
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/595'
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/cli.ts
  - src/guidelines/agent-guidelines.md
  - src/test/agent-instructions.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track GitHub issue #595: generated agent guidance should avoid command examples that Claude Code rejects as ansi_c_string or unsafe shell forms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Agent-facing instructions avoid ANSI-C string, heredoc, command substitution, and similarly rejected shell forms where possible.
- [x] #2 Long multiline fields have a documented safe alternative for common agents.
- [x] #3 Guideline snapshots/tests are updated to cover the safer examples.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated CLI and agent guidance to lead with sandbox-safe multiline forms and added regression coverage for the guidance/help text.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Agent multiline guidance now leads with repeat-append and real-newline forms, CLI help no longer advertises sandbox-rejected shell forms, and validation passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
