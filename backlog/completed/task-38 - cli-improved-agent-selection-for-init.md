---
id: task-38
title: 'CLI: Improved Agent Selection for Init'
status: Done
assignee:
  - '@AI'
created_date: '2025-06-10'
updated_date: '2025-06-10'
labels: []
dependencies: []
---

## Description
Implement interactive checkbox-style selection for agents during 'backlog init'. Users should select one or multiple agents using space or enter, similar to modern CLI tools.

## Acceptance Criteria
- [x] Interactive checkbox UI replaces current agent selection
- [x] Users can select one or multiple agents using space and confirm with enter
- [x] Works consistently across Node and Bun runtimes
- [x] Task committed to repository

## Implementation Notes
- Added `prompts` dependency for interactive CLI prompts.
- Replaced numeric input with `multiselect` checkbox prompt in `src/cli.ts`.
- Supports selecting multiple agent instruction files with space/enter.
