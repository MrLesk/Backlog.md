---
id: task-269
title: Refactor backlog init agent selection
status: Done
assignee:
  - '@codex'
created_date: '2025-09-17 21:19'
updated_date: '2025-09-18 17:41'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users often skip reading the prompts in backlog init and simply press enter through the agent selection step. Update the interactive flow so pressing enter while focused on an agent selects the currently highlighted agent (mirroring a single-select action), while space retains multi-select behavior. Ensure the command validates that at least one agent is chosen before continuing and that enter does not fall back to auto-selecting the first agent when nothing is highlighted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter selects the currently highlighted agent file in the backlog init agent picker.
- [x] #2 Space continues to support multi-select for choosing multiple agents.
- [x] #3 Backlog init blocks progress until at least one agent file is explicitly selected.
- [x] #4 Pressing enter without a selection does not default to the first agent; the user must select manually.
<!-- AC:END -->


## Implementation Notes

Enter now auto-selects the highlighted agent during interactive init, with space still toggling multi-select.
Selection processing requires at least one agent file, rejecting only-"none" submissions.
Added utility + tests for the selection normalization logic and updated CLI tests pass.
