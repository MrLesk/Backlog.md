---
id: BACK-440
title: Handle cancel in agents update prompt
status: Done
assignee:
  - '@alex-agent'
created_date: '2026-04-25 21:55'
updated_date: '2026-04-25 22:00'
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
- [x] #1 Cancelling the `backlog agents --update-instructions` multiselect exits the command cleanly with a clear cancellation message.
- [x] #2 The cancel path does not create, rewrite, or stage agent instruction files.
- [x] #3 Submitting an empty selection remains distinct from cancellation and does not regress existing no-selection behavior.
- [x] #4 Selecting one or more instruction files still updates the requested files normally.
- [x] #5 Verification includes an interactive TTY-style reproduction of the pre-fix problem and confirmation that the PR branch fixes it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-25: PR #575 TTY verification used `/usr/bin/expect` with disposable initialized Backlog projects. Base/main cancellation reproduced the confusing empty-selection message; PR branch cancellation printed the explicit cancellation message and did not create CLAUDE.md/AGENTS.md/GEMINI.md/Copilot instruction files. Empty Enter and Space+Enter paths were also checked on the PR branch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified PR #575 for the `backlog agents --update-instructions` cancel path and tracked it under BACK-440. Reproduced the current main behavior with a real `expect` pseudo-terminal: pressing Escape at the multiselect prompt exits through the empty-selection path and prints `No files selected for update.`. Verified the PR branch changes that behavior to print `Agent instruction update cancelled.` and return without creating instruction files. Also verified Enter with no selection still prints `No files selected for update.` and Space+Enter still updates `CLAUDE.md` normally. Local validation passed: `bun test src/test/cli-agents.test.ts`, `bunx tsc --noEmit`, and `bun run check .`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
