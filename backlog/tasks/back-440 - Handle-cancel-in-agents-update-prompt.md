---
id: BACK-440
title: Handle cancel in agents update prompt
status: To Do
assignee:
  - '@alex-agent'
created_date: '2026-04-25 21:55'
labels:
  - bug
  - cli
  - agents
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/192'
  - 'https://github.com/MrLesk/Backlog.md/pull/575'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Issue #192 and PR #575 cover the interactive `backlog agents --update-instructions` flow. When a user cancels the agent-instruction file multiselect prompt, Backlog.md should treat that as an explicit abort instead of continuing as though the user submitted an empty selection.

This task tracks validating and merging PR #575. The fix should stay focused on the cancel path: cancelling the prompt exits cleanly, does not update instruction files, and preserves normal update behavior when files are selected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cancelling the `backlog agents --update-instructions` multiselect exits the command cleanly with a clear cancellation message.
- [ ] #2 The cancel path does not create, rewrite, or stage agent instruction files.
- [ ] #3 Submitting an empty selection remains distinct from cancellation and does not regress existing no-selection behavior.
- [ ] #4 Selecting one or more instruction files still updates the requested files normally.
- [ ] #5 Verification includes an interactive TTY-style reproduction of the pre-fix problem and confirmation that the PR branch fixes it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
