---
id: task-84
title: Add -ac flag for acceptance criteria in task create/edit
status: Done
assignee:
  - '@claude'
created_date: '2025-06-18'
updated_date: '2025-06-19'
labels:
  - enhancement
  - cli
dependencies: []
---

## Description

Add acceptance criteria flag support to task creation and editing commands. Include -ac flag and consider full --acceptance-criteria command option.

## Acceptance Criteria

- [x] Add -ac flag to `backlog task create` command
- [x] Add -ac flag to `backlog task edit` command  
- [x] Consider implementing full --acceptance-criteria flag as alternative
- [x] Acceptance criteria should be added as checkbox list in markdown
- [x] Preserve existing -d (description) functionality
- [x] Update help text for both create and edit commands
- [x] Add tests for acceptance criteria flag functionality
- [x] Handle multiple acceptance criteria items (comma-separated or multiple flags)

## Implementation Notes

- Implemented both `--ac` and `--acceptance-criteria` flags for both create and edit commands
- Used Commander.js convention where short flags must be single character, so used `--ac` as a long option
- Acceptance criteria are comma-separated and automatically formatted as markdown checkboxes
- The `updateTaskAcceptanceCriteria` function handles adding or replacing criteria in the task description
- Added comprehensive test coverage including edge cases and both flags
- The feature supports multiple criteria in a single flag value (comma-separated)
